import type { PickupDef } from '@cup/bouncer-shared';
import { PICKUP_CATALOG } from '@cup/bouncer-shared';
import type { PlayerId } from './types.js';

/**
 * Tracks which pickup instances are still on the field and what each player holds.
 * Pure data — no socket IO, no timers.
 */
export class PickupManager {
  private available = new Set<number>();
  private playerHeld = new Map<PlayerId, string>();

  constructor(private readonly pickupDefs: PickupDef[]) {
    this.reset();
  }

  /** Restore all instances and clear held pickups (call at round start). */
  reset() {
    this.available = new Set(this.pickupDefs.map((_, i) => i));
    this.playerHeld.clear();
  }

  /**
   * Records a client-reported collection. Validates the instance exists and
   * isn't already taken. Returns the pickupKey on success, null on failure.
   * Replaces any pickup the player already holds.
   */
  onPickupCollected(playerId: PlayerId, instanceId: number): string | null {
    if (this.playerHeld.has(playerId)) return null; // already holding one — can't grab another
    if (!this.available.has(instanceId)) return null;
    const def = this.pickupDefs[instanceId];
    if (!def || !PICKUP_CATALOG[def.pickupKey]) return null;

    this.available.delete(instanceId);
    this.playerHeld.set(playerId, def.pickupKey);
    return def.pickupKey;
  }

  /**
   * Consumes and returns the player's held pickup key, or null if they hold nothing.
   */
  usePickup(playerId: PlayerId): string | null {
    const key = this.playerHeld.get(playerId);
    if (!key) return null;
    this.playerHeld.delete(playerId);
    return key;
  }

  removePlayer(playerId: PlayerId) {
    this.playerHeld.delete(playerId);
  }
}
