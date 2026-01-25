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

export type LevelObject = PlatformDef | PolygonDef | SpawnPointDef;

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
}
