export type PlatformDef = {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export type LevelDefinition = {
    objects: PlatformDef[];
}


export async function loadLevel(name: string): Promise<LevelDefinition> {
    switch (name) {
        case 'floor':
            return (await import('./levels/level1.js')).default;
        default:
            return (await import('./levels/level1.js')).default;
  }
}