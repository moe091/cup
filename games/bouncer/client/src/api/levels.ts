import { LevelDefinition } from '@cup/bouncer-shared';

export async function loadLevelDef(id: string): Promise<LevelDefinition> {
    const res = await fetch(`/api/games/bouncer/levels/${id}`, { credentials: 'include'} );
    if (!res.ok) throw new Error('listLevels failed: ' + res.status);
    const level = await res.json();

    return level.data;
}
