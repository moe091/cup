/**
 * Hazard catalog: the shared definition of every placeable hazard (sprite +
 * collision body), keyed by a string id. The catalog DATA lives in a runtime
 * file (apps/web/public/games/bouncer/hazards.json) so it can be hand-edited and
 * tuned without a rebuild; this module holds the TYPES + resolution/validation
 * used by both the editor (render) and the engine (build fixtures, step 4).
 *
 * All dimensions are in pixels, relative to the sprite's CENTER. A hazard is
 * placed at a point (x, y): the sprite renders centered there, and the body sits
 * at (x + offsetX, y + offsetY).
 */

export type HazardBody =
  | { shape: 'circle'; radius?: number; offsetX?: number; offsetY?: number }
  | { shape: 'box'; width?: number; height?: number; offsetX?: number; offsetY?: number };

export type HazardCatalogEntry = {
  key: string;
  displayName: string;
  spritePath: string;
  spriteWidth: number;
  spriteHeight: number;
  spriteRotationSpeed?: number; // degrees/sec the sprite spins in-game (default 0)
  isSensor?: boolean; // default true
  body?: HazardBody; // default: box of sprite bounds × DEFAULT_BODY_SCALE, no offset
};

export type HazardCatalog = Record<string, HazardCatalogEntry>;

export type ResolvedHazardBody =
  | { shape: 'circle'; radius: number; offsetX: number; offsetY: number }
  | { shape: 'box'; width: number; height: number; offsetX: number; offsetY: number };

// When body dimensions are omitted, the body defaults to this fraction of the
// sprite size — slightly smaller than the art so collisions only register on
// clear contact. Explicit dimensions in the catalog are used exactly as given.
export const DEFAULT_BODY_SCALE = 0.95;

/** Fully resolves a catalog entry's body, applying defaults. */
export function resolveHazardBody(entry: HazardCatalogEntry): ResolvedHazardBody {
  const body = entry.body;
  const offsetX = body?.offsetX ?? 0;
  const offsetY = body?.offsetY ?? 0;

  if (body?.shape === 'circle') {
    const radius = body.radius ?? (Math.min(entry.spriteWidth, entry.spriteHeight) / 2) * DEFAULT_BODY_SCALE;
    return { shape: 'circle', radius, offsetX, offsetY };
  }

  const width = (body?.shape === 'box' ? body.width : undefined) ?? entry.spriteWidth * DEFAULT_BODY_SCALE;
  const height = (body?.shape === 'box' ? body.height : undefined) ?? entry.spriteHeight * DEFAULT_BODY_SCALE;
  return { shape: 'box', width, height, offsetX, offsetY };
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// console isn't in this package's TS lib (platform-agnostic); access it safely.
function warn(message: string) {
  (globalThis as { console?: { warn?: (m: string) => void } }).console?.warn?.(message);
}

/**
 * Validates raw (hand-edited) JSON into a catalog, keying each entry by its
 * object key and dropping malformed entries with a warning — so a typo never
 * breaks the editor/game.
 */
export function coerceHazardCatalog(raw: unknown): HazardCatalog {
  const out: HazardCatalog = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const e = value as Partial<HazardCatalogEntry> | null;
    if (
      e &&
      typeof e.displayName === 'string' &&
      typeof e.spritePath === 'string' &&
      isFiniteNum(e.spriteWidth) &&
      isFiniteNum(e.spriteHeight)
    ) {
      out[key] = {
        key,
        displayName: e.displayName,
        spritePath: e.spritePath,
        spriteWidth: e.spriteWidth,
        spriteHeight: e.spriteHeight,
        spriteRotationSpeed: isFiniteNum(e.spriteRotationSpeed) ? e.spriteRotationSpeed : 0,
        isSensor: e.isSensor ?? true,
        body: e.body,
      };
    } else {
      warn(`[hazards] skipping malformed catalog entry: ${key}`);
    }
  }

  return out;
}
