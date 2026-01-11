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
  switch (name) {
    case 'floor':
      level = (await import('./levels/level1.js')).default;
      break;
    default:
      level = (await import('./levels/testLevel.js')).default;
      break;
  }
  return { ...level, name };
}
