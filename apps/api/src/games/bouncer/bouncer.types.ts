import { LevelDefinition } from '@cup/bouncer-shared';

type LevelListItem = {
  id: string;
  name: string;
  ownerUserId: string | null;
  updatedAt: string;
};

type LevelResponse = {
  id: string;
  name: string;
  ownerUserId: string | null;
  data: LevelDefinition;
};
