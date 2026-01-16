import type { LevelDefinition } from '../level.js';

const level: LevelDefinition = {
  name: 'floor',
  gridSize: 16,
  objects: [
    { type: 'platform', name: 'floor_plat_1', x: 480, y: 520, width: 640, height: 20 },
    { type: 'spawnPoint', name: 'spawn_1', x: 400, y: 100 },
    { type: 'spawnPoint', name: 'spawn_2', x: 560, y: 100 },
  ],
};

export default level;
