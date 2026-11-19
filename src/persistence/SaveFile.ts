// Save files: a city as a single text file the player can download, keep,
// share, and load back in — on any browser, port or machine. (Saves in the
// slots live in the browser's IndexedDB, which is tied to one site address.)
//
// The file is JSON. Typed-array layers are stored as base64, tagged with their
// element type so they come back as the same kind of array.

import { SAVE_VERSION, NewerSaveError, migrate, type SaveMeta, type SaveRecord, type WorldSnapshot } from './SaveFormat';

export const SAVE_FILE_FORMAT = 'city-builder-save';
export const SAVE_FILE_EXTENSION = '.citysave.json';

interface EncodedArray { type: 'u8' | 'u16'; base64: string }

function isEncodedArray(v: unknown): v is EncodedArray {
  return typeof v === 'object' && v !== null
    && typeof (v as EncodedArray).base64 === 'string'
    && ((v as EncodedArray).type === 'u8' || (v as EncodedArray).type === 'u16');
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
    ? { type: 'u16', base64: toBase64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) }
    : { type: 'u8', base64: toBase64(a) };
}

function decodeArray(e: EncodedArray): Uint8Array | Uint16Array {
  const bytes = fromBase64(e.base64);
  if (e.type === 'u8') return bytes;
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
    const array = decodeArray(value);
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
