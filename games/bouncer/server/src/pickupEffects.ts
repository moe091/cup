import type { PlayerEffectAppliedPayload } from '@cup/bouncer-shared';

type BroadcastFn = (name: string, payload: unknown) => void;

type EffectFn = (broadcast: BroadcastFn, activatingPlayerId: string, allPlayerIds: string[]) => void;

/**
 * Maps pickup keys to their server-side effect.
 * Adding a new pickup = add one entry here. No other files need to change.
 */
const EFFECT_REGISTRY: Record<string, EffectFn> = {
  boost: (broadcast, activatingPlayerId) => {
    const payload: PlayerEffectAppliedPayload = {
      playerId: activatingPlayerId,
      effectKey: 'boost',
      durationMs: 6000,
    };
    broadcast('player_effect_applied', payload);
  },

  freeze: (broadcast, activatingPlayerId, allPlayerIds) => {
    // Each frozen player gets their own message so the client knows which ball to freeze.
    allPlayerIds
      .filter((id) => id !== activatingPlayerId)
      .forEach((targetId) => {
        const payload: PlayerEffectAppliedPayload = {
          playerId: targetId,
          effectKey: 'freeze',
          durationMs: 1000,
        };
        broadcast('player_effect_applied', payload);
      });
  },
};

/**
 * Looks up the effect for the given key and fires it.
 * Returns true if the key was found, false if unknown.
 */
export function applyPickupEffect(
  effectKey: string,
  broadcast: BroadcastFn,
  activatingPlayerId: string,
  allPlayerIds: string[],
): boolean {
  const fn = EFFECT_REGISTRY[effectKey];
  if (!fn) return false;
  fn(broadcast, activatingPlayerId, allPlayerIds);
  return true;
}
