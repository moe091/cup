import type { CommunityPermissionConfig } from '@cup/shared-types';

export const DEFAULT_COMMUNITY_PERMISSION_CONFIG: CommunityPermissionConfig = {
  createChannel: 5,
  editChannelName: 6,
  deleteChannel: 6,
  editGeneral: 9,
};

export function readCommunityPermissionConfig(raw: unknown): CommunityPermissionConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid community permissionConfig: expected object');
  }

  const source = raw as Record<string, unknown>;
  if (
    typeof source.createChannel !== 'number' ||
    typeof source.editChannelName !== 'number' ||
    typeof source.deleteChannel !== 'number' ||
    typeof source.editGeneral !== 'number'
  ) {
    throw new Error('Invalid community permissionConfig: expected numeric permission levels');
  }

  return {
    createChannel: source.createChannel,
    editChannelName: source.editChannelName,
    deleteChannel: source.deleteChannel,
    editGeneral: source.editGeneral,
  };
}
