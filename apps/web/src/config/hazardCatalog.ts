import { coerceHazardCatalog, type HazardCatalog } from "@cup/bouncer-shared";

/**
 * Runtime hazard catalog, fetched from the static hazards.json served at
 * apps/web/public/data/bouncer/hazards.json (copied into the build for nginx in
 * prod). Hand-editable + tunable without a rebuild. Malformed entries are
 * dropped by coerceHazardCatalog; a missing/bad file yields {}.
 */
export function loadHazardCatalog(): Promise<HazardCatalog> {
  return fetch(`${import.meta.env.BASE_URL}data/bouncer/hazards.json`, { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<unknown>) : {}))
    .then((raw) => coerceHazardCatalog(raw))
    .catch(() => ({}) as HazardCatalog);
}
