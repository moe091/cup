export type PlatformDef = {
  type: 'platform';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PolygonDef = {
  type: 'polygon';
  name: string;
  vertices: Array<{ x: number; y: number }>;
  friction?: number;
  restitution?: number;
};

export type SpawnPointDef = {
  type: 'spawnPoint';
  name?: string;
  x: number;
  y: number;
};

export type GoalDef = {
  type: 'goal';
  name?: string;
  x: number;
  y: number;
  size: number;
};

export type CheckpointDef = {
  type: 'checkpoint';
  name?: string;
  // The sensor zone players pass through.
  rect: { x: number; y: number; width: number; height: number };
  // Where players respawn after a hazard if this was their last checkpoint.
  respawn: { x: number; y: number };
};

export type HazardDef = {
  type: 'hazard';
  // References a HazardCatalogEntry by key; the catalog supplies sprite + body.
  hazardKey: string;
  x: number;
  y: number;
};

export type LevelObject = PlatformDef | PolygonDef | SpawnPointDef | GoalDef | CheckpointDef | HazardDef;

export type LevelDefinition = {
  name: string;
  objects: LevelObject[];
  gridSize?: number;
};

export type LevelResponse = {
  id: string;
  name: string;
  ownerUserId: string | null;
  data: LevelDefinition;
};

export type LevelListItem = {
  id: string;
  name: string;
  ownerUserId: string | null;
  visibility: 'SYSTEM' | 'PUBLIC' | 'PRIVATE';
  updatedAt: string;
};
