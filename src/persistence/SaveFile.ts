// Save files: a city as a single text file the player can download, keep,
// share, and load back in — on any browser, port or machine. (Saves in the
// slots live in the browser's IndexedDB, which is tied to one site address.)
//
// The file is JSON. Typed-array layers are stored as base64, tagged with their
// element type so they come back as the same kind of array. Since save
// version 12 each layer is run-length packed first ('u8z', 'u16z'): most of a
// city's layers are long runs of one value, so a file is a fraction of the
// size. Files written before that ('u8', 'u16', not packed) still load.

import { SAVE_VERSION, NewerSaveError, migrate, type SaveMeta, type SaveRecord, type WorldSnapshot } from './SaveFormat';

export const SAVE_FILE_FORMAT = 'city-builder-save';
export const SAVE_FILE_EXTENSION = '.citysave.json';

interface EncodedArray { type: 'u8' | 'u16' | 'u8z' | 'u16z'; base64: string }

function isEncodedArray(v: unknown): v is EncodedArray {
  if (typeof v !== 'object' || v === null || typeof (v as EncodedArray).base64 !== 'string') return false;
  const type = (v as EncodedArray).type;
  return type === 'u8' || type === 'u16' || type === 'u8z' || type === 'u16z';
}

/**
 * Run-length packing (PackBits). The packed bytes are a string of groups, each
 * led by a control byte c: 0–127, the next c + 1 bytes are taken as they are;
 * 129–255, the next byte is repeated 257 − c times (2 to 128); 128 is not used.
 * Bytes with no runs grow by 1 in 128 at most.
 */
export function packBytes(bytes: Uint8Array): Uint8Array {
  const n = bytes.length;
  const out = new Uint8Array(n + (n >> 7) + 2);
  let o = 0, i = 0;
  while (i < n) {
    // How long is the run of this byte from here?
    const v = bytes[i];
    let run = 1;
    while (run < 128 && i + run < n && bytes[i + run] === v) run++;
    if (run >= 3) {
      out[o++] = 257 - run; out[o++] = v;
      i += run;
      continue;
    }
    // Bytes as they are, up to the next run of three or more (or 128 of them).
    const start = i;
    i += run;
    while (i < n && i - start < 128) {
      if (i + 2 < n && bytes[i] === bytes[i + 1] && bytes[i] === bytes[i + 2]) break;
      i++;
    }
    if (i - start > 128) i = start + 128;
    out[o++] = i - start - 1;
    out.set(bytes.subarray(start, i), o);
    o += i - start;
  }
  return out.subarray(0, o);
}

/** The bytes `packBytes` packed. Throws if the packed bytes are not well formed. */
export function unpackBytes(packed: Uint8Array): Uint8Array {
  // First pass: the length.
  let n = 0;
  for (let i = 0; i < packed.length;) {
    const c = packed[i++];
    if (c < 128) { n += c + 1; i += c + 1; }
    else if (c > 128) { n += 257 - c; i++; }
    else throw new Error('Save file is damaged (bad packed layer).');
    if (i > packed.length) throw new Error('Save file is damaged (packed layer cut short).');
  }
  const out = new Uint8Array(n);
  for (let i = 0, o = 0; i < packed.length;) {
    const c = packed[i++];
    if (c < 128) { out.set(packed.subarray(i, i + c + 1), o); o += c + 1; i += c + 1; }
    else { const len = 257 - c; out.fill(packed[i++], o, o + len); o += len; }
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  // btoa wants a "binary string"; build it in chunks to stay under argument limits.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeArray(a: Uint8Array | Uint16Array): EncodedArray {
  return a instanceof Uint16Array
    ? { type: 'u16z', base64: toBase64(packBytes(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))) }
    : { type: 'u8z', base64: toBase64(packBytes(a)) };
}

function decodeArray(e: EncodedArray): Uint8Array | Uint16Array {
  const stored = fromBase64(e.base64);
  const bytes = e.type === 'u8z' || e.type === 'u16z' ? unpackBytes(stored) : stored;
  if (e.type === 'u8' || e.type === 'u8z') return bytes;
  if (bytes.length % 2 !== 0) throw new Error('Save file is damaged (odd-length 16-bit layer).');
  return new Uint16Array(bytes.buffer, 0, bytes.length / 2);
}

/** A city as the text of a save file. */
export function encodeSaveFile(meta: SaveMeta, snapshot: WorldSnapshot): string {
  const layers: Record<string, EncodedArray> = {};
  for (const [name, array] of Object.entries(snapshot.layers)) {
    if (array) layers[name] = encodeArray(array);
  }
  return JSON.stringify({
    format: SAVE_FILE_FORMAT,
    version: SAVE_VERSION,
    meta,
    snapshot: { ...snapshot, layers },
  });
}

/**
 * Read the text of a save file back into a save record, upgraded to the
 * current save version. Throws an Error with a readable message if the text
 * is not a save file or is damaged.
 */
export function decodeSaveFile(text: string): SaveRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a save file (it is not valid JSON).');
  }
  const file = raw as { format?: unknown; version?: unknown; meta?: SaveMeta; snapshot?: { layers?: Record<string, unknown>; width?: number; height?: number } };
  if (typeof file !== 'object' || file === null || file.format !== SAVE_FILE_FORMAT) {
    throw new Error('Not a city-builder save file.');
  }
  if (typeof file.version !== 'number' || !file.meta || !file.snapshot || !file.snapshot.layers) {
    throw new Error('Save file is incomplete.');
  }
  if (file.version > SAVE_VERSION) throw new NewerSaveError(file.version);

  const { width, height } = file.snapshot;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width! <= 0 || height! <= 0) {
    throw new Error('Save file is damaged (bad map size).');
  }
  const layers: Record<string, Uint8Array | Uint16Array> = {};
  for (const [name, value] of Object.entries(file.snapshot.layers)) {
    if (!isEncodedArray(value)) throw new Error(`Save file is damaged (layer "${name}").`);
    let array: Uint8Array | Uint16Array;
    try { array = decodeArray(value); } catch { throw new Error(`Save file is damaged (layer "${name}").`); }
    if (array.length !== width! * height!) throw new Error(`Save file is damaged (layer "${name}" is the wrong size).`);
    layers[name] = array;
  }

  return migrate({
    version: file.version,
    userId: 'file',
    slot: -1,
    meta: file.meta,
    snapshot: { ...file.snapshot, layers },
  });
}

/** A safe file name for a city called `name`. */
export function saveFileName(name: string): string {
  const base = name.trim().replace(/[^A-Za-z0-9 _-]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'city';
  return base + SAVE_FILE_EXTENSION;
}
