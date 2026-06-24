export type PickupCatalogEntry = {
  key: string;
  displayName: string;
  /** Path to the sprite used in the editor picker and above the player's head while held. */
  iconPath: string;
  /** Display size for the picker (pixels). */
  spriteWidth: number;
  spriteHeight: number;
  /** Hex color used for the pickup's field sprite (colored circle). */
  color: number;
};

export const PICKUP_CATALOG: Record<string, PickupCatalogEntry> = {
  boost: {
    key: 'boost',
    displayName: 'Boost',
    iconPath: '/games/bouncer/pickups/boost_pickup.png',
    spriteWidth: 64,
    spriteHeight: 64,
    color: 0xff4400,
  },
  freeze: {
    key: 'freeze',
    displayName: 'Freeze',
    iconPath: '/games/bouncer/pickups/freeze_pickup.png',
    spriteWidth: 64,
    spriteHeight: 64,
    color: 0x44aaff,
  },
};
