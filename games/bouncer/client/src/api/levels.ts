import { LevelDefinition, LevelListItem } from '@cup/bouncer-shared';

export async function loadLevelDef(id: string): Promise<LevelDefinition> {
  const res = await fetch(`/api/games/bouncer/levels/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('listLevels failed: ' + res.status);
  const level = await res.json();

  return level.data;
}

export async function listLevels(): Promise<LevelListItem[]> {
  const res = await fetch('/api/games/bouncer/levels', { credentials: 'include' });
  if (!res.ok) throw new Error('listLevels failed: ' + res.status);
  const levels = await res.json();

  return levels as LevelListItem[];
}
