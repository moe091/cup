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

export async function loadLevel(name: string): Promise<LevelDefinition> {
  let level: LevelDefinition;
  
  level = (await import('./levels/test2.js')).default;
  return { ...level, name };
}

export const levelNames = ["level1", "test2", "testLevel"]; 