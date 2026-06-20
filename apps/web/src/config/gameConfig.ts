import type { BouncerConfigInput } from "@cup/bouncer-client";

/**
 * Runtime game configuration, fetched from the static `game_config.json` served
 * at the app root (apps/web/public/game_config.json in dev, copied into the
 * build output for nginx in prod) - Editable in deployment without a
 * rebuild. 
 *
 * All fields optional: a missing file or key falls back to in-code defaults,
 * so the app never breaks on bad/absent config. (TODO:: maybe add warnings when it falls back to default? Will wait until I implement real server-side logging and plumbing to send logs from client to server)
 */
export type GameConfig = {
  bouncer?: BouncerConfigInput;
};

let cached: Promise<GameConfig> | null = null;

/** Fetches game_config.json once per session (cached). Never rejects — returns
 * {} on any failure so callers can safely fall back to defaults. */
export function loadGameConfig(): Promise<GameConfig> {
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}game_config.json`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<GameConfig>) : {}))
      .catch(() => ({}));
  }
  return cached;
}
