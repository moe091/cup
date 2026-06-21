import { DEFAULT_PHYSICS_CONFIG, type BouncerPhysicsConfig } from '@cup/bouncer-engine';

export type { BouncerPhysicsConfig } from '@cup/bouncer-engine';

/**
 * Full bouncer config as accepted by connectBouncer() — sourced at runtime from
 * game_config.json's "bouncer" object (apps/web). Both sections optional with
 * per-field fallback, so the game always works with no/partial config.
 */
export type BouncerConfigInput = {
  netcode?: Partial<BouncerNetConfig>;
  physics?: Partial<BouncerPhysicsConfig>;
};

/**
 * Bouncer netcode tuning. These are supplied at runtime by the host app
 * (apps/web fetches them from game_config.json under the "bouncer.netcode" key)
 * and passed into connectBouncer(). Any missing/invalid field falls back to the
 * default below, so the game always works even with no config file.
 */
export type BouncerNetConfig = {
  // How far in the past (ms) remote balls are rendered, to absorb network
  // jitter. Higher = smoother but more delay. Must exceed normal arrival jitter.
  interpolationDelayMs: number;
  // Max time (ms) a remote ball is projected along its last-known velocity when
  // the interpolation buffer underruns (a late/dropped packet). Higher hides
  // bigger gaps at the cost of larger mispredictions.
  extrapolationCapMs: number;
  // Always-on forward extrapolation (ms) for remote balls, cancelling the
  // residual latency gap so neck-and-neck races look aligned (≈ min one-way
  // latency). Mostly shifts the interp cursor forward into existing buffer.
  // 0 = off.
  latencyExtrapolationMs: number;
  // How far in the past (ms) the LOCAL ball is rendered so it lines up in time
  // with remote balls. Adds this much perceived input latency. 0 = instant.
  localRenderDelayMs: number;
};

export const DEFAULT_NET_CONFIG: BouncerNetConfig = {
  interpolationDelayMs: 60,
  extrapolationCapMs: 120,
  latencyExtrapolationMs: 20,
  localRenderDelayMs: 60,
};

const pickFinite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Merges a partial/untrusted netcode config (e.g. parsed JSON) over the
 * defaults, keeping only finite numbers. */
export function resolveNetConfig(partial?: Partial<BouncerNetConfig> | null): BouncerNetConfig {
  return {
    interpolationDelayMs: pickFinite(partial?.interpolationDelayMs, DEFAULT_NET_CONFIG.interpolationDelayMs),
    extrapolationCapMs: pickFinite(partial?.extrapolationCapMs, DEFAULT_NET_CONFIG.extrapolationCapMs),
    latencyExtrapolationMs: pickFinite(partial?.latencyExtrapolationMs, DEFAULT_NET_CONFIG.latencyExtrapolationMs),
    localRenderDelayMs: pickFinite(partial?.localRenderDelayMs, DEFAULT_NET_CONFIG.localRenderDelayMs),
  };
}

/** Same as resolveNetConfig but for the physics section (consumed by Engine). */
export function resolvePhysicsConfig(partial?: Partial<BouncerPhysicsConfig> | null): BouncerPhysicsConfig {
  return {
    jumpPower: pickFinite(partial?.jumpPower, DEFAULT_PHYSICS_CONFIG.jumpPower),
    moveAcceleration: pickFinite(partial?.moveAcceleration, DEFAULT_PHYSICS_CONFIG.moveAcceleration),
    doubleJumpForce: pickFinite(partial?.doubleJumpForce, DEFAULT_PHYSICS_CONFIG.doubleJumpForce),
    dashXForce: pickFinite(partial?.dashXForce, DEFAULT_PHYSICS_CONFIG.dashXForce),
  };
}
