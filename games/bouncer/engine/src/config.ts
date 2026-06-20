/**
 * Tunable physics values for the bouncer ball. Supplied at runtime (apps/web
 * reads game_config.json -> bouncer.physics and threads it down to the Engine).
 * Any omitted/invalid field keeps the World's built-in default below.
 *
 * Values are in planck (Box2D) units, not pixels — they're applied as impulses
 * to a ball of radius 0.26 / density 0.8, so small numbers are expected.
 */
export type BouncerPhysicsConfig = {
  // Initial upward impulse of a jump (the "pop"). Variable jump-height hold is a
  // separate internal value.
  jumpPower: number;
  // Per-tick horizontal impulse applied while holding left/right (the linear
  // push; the ball's roll torque is a separate internal value).
  moveAcceleration: number;
  // Impulse magnitude of a dash in the input direction. Consumed once the dash
  // mechanic is implemented; present now so it's tunable from day one.
  dashPower: number;
};

export const DEFAULT_PHYSICS_CONFIG: BouncerPhysicsConfig = {
  jumpPower: 1.1,
  moveAcceleration: 0.025,
  dashPower: 2.5,
};
