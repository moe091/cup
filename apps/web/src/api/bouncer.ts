export type LevelListItem = {
  id: string;
  name: string;
  ownerUserId: string | null;
  visibility: 'SYSTEM' | 'PUBLIC' | 'PRIVATE';
  updatedAt: string;
}

export async function listLevels(): Promise<LevelListItem[]> {
    const res = await fetch('/api/games/bouncer/levels', { credentials: 'include' });
    if (!res.ok) throw new Error('listLevels failed: ' + res.status);
    return res.json();
}