import { LevelDefinition } from '@cup/bouncer-shared';

const API_BASE = 'http://localhost:3000';
async function apiGet<T>(path: string): Promise<T> {
  console.log('FETCHING: ', `${API_BASE}${path}`);
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadLevelDef(id: string) {
  console.log('[DEBUG] loadLevelDef called:: ', id);
  const level = await apiGet<{ data: LevelDefinition }>(`/api/games/bouncer/levels/${id}`);
  return level.data;
}
