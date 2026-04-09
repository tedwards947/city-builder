export interface SpriteSheetManifest {
  sheets: Record<string, {
    path: string;           // relative path to PNG
    tileSize: number;       // base tile size for this sheet
  }>;
  sprites: Record<string, {
    tags: string[];         // tag list
    weight?: number;        // default: 1
    frame?: {
      sheet: string;
      x: number;
      y: number;
      w: number;
      h: number;
      anchorX?: number;
      anchorY?: number;
    };
    animation?: {
      sheet: string;
      frames: Array<{ x: number; y: number; w: number; h: number }>;
      frameDuration: number;
      loop: boolean;
    };
  }>;
}

export class AssetManager {
  private _sheets: Map<string, HTMLImageElement>;
  private _loadPromises: Map<string, Promise<HTMLImageElement>>;
  private _manifest: SpriteSheetManifest | null;

  constructor() {
    this._sheets = new Map();
    this._loadPromises = new Map();
    this._manifest = null;
  }

  async loadManifest(path: string): Promise<void> {
    const response = await fetch(path);
    this._manifest = await response.json();
  }

  async loadSheet(sheetId: string): Promise<HTMLImageElement> {
    // Return cached sheet if already loaded
    if (this._sheets.has(sheetId)) {
      return this._sheets.get(sheetId)!;
    }

    // Return in-flight promise if already loading
    if (this._loadPromises.has(sheetId)) {
      return this._loadPromises.get(sheetId)!;
    }

    // Start loading
    if (!this._manifest) {
      throw new Error('Manifest not loaded');
    }

    const sheetInfo = this._manifest.sheets[sheetId];
    if (!sheetInfo) {
      throw new Error(`Sheet ${sheetId} not found in manifest`);
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this._sheets.set(sheetId, img);
        this._loadPromises.delete(sheetId);
        resolve(img);
      };
      img.onerror = () => {
        this._loadPromises.delete(sheetId);
        reject(new Error(`Failed to load sheet: ${sheetInfo.path}`));
      };
      img.src = sheetInfo.path;
    });

    this._loadPromises.set(sheetId, promise);
    return promise;
  }

  getSheet(sheetId: string): HTMLImageElement | null {
    return this._sheets.get(sheetId) ?? null;
  }

  getManifest(): SpriteSheetManifest | null {
    return this._manifest;
  }

  // Preload all sheets referenced in manifest
  async preloadAll(): Promise<void> {
    if (!this._manifest) {
      throw new Error('Manifest not loaded');
    }

    const sheetIds = Object.keys(this._manifest.sheets);
    await Promise.all(sheetIds.map(id => this.loadSheet(id)));
  }
}

// Singleton
export const ASSET_MANAGER = new AssetManager();
