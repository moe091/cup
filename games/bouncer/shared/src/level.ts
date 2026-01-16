export type PlatformDef = {
  type: 'platform';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpawnPointDef = {
  type: 'spawnPoint';
  name?: string;
  x: number;
  y: number;
};

export type LevelObject = PlatformDef | SpawnPointDef;

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

