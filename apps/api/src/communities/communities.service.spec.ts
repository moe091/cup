import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { CommunitiesService } from './communities.service';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let prismaMock: {
    $transaction: jest.Mock;
    community: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
    communityMember: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
    };
    channel: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let storageServiceMock: {
    createCommunityIconUploadTarget: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(),
      community: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      communityMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      channel: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    storageServiceMock = {
      createCommunityIconUploadTarget: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageServiceMock },
      ],
    }).compile();

    service = module.get<CommunitiesService>(CommunitiesService);
  });

  it('creates community, owner membership, and default channels', async () => {
    prismaMock.community.findUnique.mockResolvedValue(null); // slug available

    const txMock = {
      community: {
        create: jest.fn().mockResolvedValue({
          id: 'community-1',
          slug: 'my-community',
          name: 'My Community',
          description: 'desc',
          joinMode: 'PUBLIC',
          iconKey: null,
        }),
      },
      communityMember: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      channel: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));

    const result = await service.createCommunity('user-1', {
      name: 'My Community',
      joinMode: 'PUBLIC',
      description: 'desc',
    });

    expect(txMock.community.create).toHaveBeenCalled();
    expect(txMock.communityMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          primaryRole: 'owner',
          permissionLevel: 10,
        }),
      }),
    );
    expect(txMock.channel.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'General', requiredPermissionLevel: 0 }),
          expect.objectContaining({ name: 'Welcome', requiredPermissionLevel: 0 }),
        ]),
      }),
    );
    expect(result.slug).toBe('my-community');
  });

  it('uses permission level 1 default channels for invite-only communities', async () => {
    prismaMock.community.findUnique.mockResolvedValue(null);
    const txMock = {
      community: {
        create: jest.fn().mockResolvedValue({
          id: 'community-1',
          slug: 'invite-only',
          name: 'Invite Only',
          description: null,
          joinMode: 'INVITE_ONLY',
          iconKey: null,
        }),
      },
      communityMember: { create: jest.fn().mockResolvedValue(undefined) },
      channel: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));

    await service.createCommunity('user-1', {
      name: 'Invite Only',
      joinMode: 'INVITE_ONLY',
      description: null,
    });

    expect(txMock.channel.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ requiredPermissionLevel: 1 }),
        ]),
      }),
    );
  });

  it('issues icon upload target only for owner', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', ownerUserId: 'owner-1' });

    await expect(
      service.requestCommunityIconUploadTarget('user-2', 'community-1', {
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(storageServiceMock.createCommunityIconUploadTarget).not.toHaveBeenCalled();
  });

  it('returns icon upload target for owner', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', ownerUserId: 'owner-1' });
    storageServiceMock.createCommunityIconUploadTarget.mockResolvedValue({
      uploadUrl: 'https://upload',
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      objectKey: 'dev/communities/community-1/icon.png',
      expiresInSeconds: 120,
    });

    const result = await service.requestCommunityIconUploadTarget('owner-1', 'community-1', {
      mimeType: 'image/png',
      sizeBytes: 1024,
    });

    expect(storageServiceMock.createCommunityIconUploadTarget).toHaveBeenCalledWith('community-1', 'image/png');
    expect(result.objectKey).toContain('community-1');
  });

  it('updates iconKey for owner with valid prefix', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', ownerUserId: 'owner-1' });
    prismaMock.community.update.mockResolvedValue({
      id: 'community-1',
      slug: 'collective-archive',
      name: 'Collective Archive',
      description: null,
      joinMode: 'PUBLIC',
      iconKey: 'dev/communities/community-1/icon.png',
    });

    const result = await service.updateCommunityIcon('owner-1', 'community-1', {
      iconKey: 'dev/communities/community-1/icon.png',
    });

    expect(prismaMock.community.update).toHaveBeenCalled();
    expect(result.iconKey).toBe('dev/communities/community-1/icon.png');
  });

  it('rejects iconKey updates with invalid prefix', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', ownerUserId: 'owner-1' });

    await expect(
      service.updateCommunityIcon('owner-1', 'community-1', {
        iconKey: 'dev/communities/another-community/icon.png',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.community.update).not.toHaveBeenCalled();
  });

  it('throws not found when requesting icon target for missing community', async () => {
    prismaMock.community.findUnique.mockResolvedValue(null);

    await expect(
      service.requestCommunityIconUploadTarget('user-1', 'missing', {
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists public communities with substring search and nextCursor', async () => {
    prismaMock.community.findMany.mockResolvedValue([
      {
        id: 'community-3',
        slug: 'dog-lovers',
        name: 'Dog Lovers Community',
        description: 'all about dogs',
        joinMode: 'PUBLIC',
        iconKey: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        _count: { members: 5 },
        members: [],
      },
      {
        id: 'community-2',
        slug: 'hotdog-fans',
        name: 'Hotdog Fans',
        description: null,
        joinMode: 'PUBLIC',
        iconKey: null,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        _count: { members: 7 },
        members: [{ userId: 'viewer-1' }],
      },
      {
        id: 'community-1',
        slug: 'old-dogs',
        name: 'Old Dogs',
        description: null,
        joinMode: 'PUBLIC',
        iconKey: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        _count: { members: 2 },
        members: [],
      },
    ]);

    const result = await service.getPublicCommunities({ search: 'dog', limit: '2' }, 'viewer-1');

    expect(prismaMock.community.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          joinMode: 'PUBLIC',
          OR: expect.any(Array),
        }),
        take: 3,
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0].slug).toBe('dog-lovers');
    expect(result.items[1].slug).toBe('hotdog-fans');
    expect(result.items[1].joinedByMe).toBe(true);
    expect(result.nextCursor).toBe('community-1');
  });

  it('lists public communities for unauthenticated viewer with joinedByMe false', async () => {
    prismaMock.community.findMany.mockResolvedValue([
      {
        id: 'community-1',
        slug: 'dog-lovers',
        name: 'Dog Lovers',
        description: null,
        joinMode: 'PUBLIC',
        iconKey: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        _count: { members: 4 },
      },
    ]);

    const result = await service.getPublicCommunities({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0].joinedByMe).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('returns community settings with canEditGeneral true for level 9+', async () => {
    prismaMock.community.findUnique.mockResolvedValueOnce({
      id: 'community-1',
      slug: 'gaming-hub',
      name: 'Gaming Hub',
      description: 'desc',
      joinMode: 'PUBLIC',
      iconKey: null,
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.communityMember.findUnique.mockResolvedValueOnce({ permissionLevel: 9 });

    const result = await service.getCommunitySettingsBySlug('gaming-hub', 'user-1');

    expect(result.canEditGeneral).toBe(true);
    expect(result.viewerPermissionLevel).toBe(9);
  });

  it('rejects community settings update for users below level 9', async () => {
    prismaMock.community.findUnique.mockResolvedValueOnce({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.communityMember.findUnique.mockResolvedValueOnce({ permissionLevel: 5 });

    await expect(
      service.updateCommunitySettingsBySlug('user-1', 'gaming-hub', {
        name: 'Gaming Hub',
        description: 'desc',
        joinMode: 'PUBLIC',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates community settings for level 9+ users', async () => {
    prismaMock.community.findUnique.mockResolvedValueOnce({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.communityMember.findUnique.mockResolvedValueOnce({ permissionLevel: 9 });
    prismaMock.community.update.mockResolvedValueOnce({
      id: 'community-1',
      slug: 'gaming-hub',
      name: 'Gaming Hub 2',
      description: 'new desc',
      joinMode: 'PUBLIC',
      iconKey: null,
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });

    const result = await service.updateCommunitySettingsBySlug('user-1', 'gaming-hub', {
      name: 'Gaming Hub 2',
      description: 'new desc',
      joinMode: 'PUBLIC',
    });

    expect(result.name).toBe('Gaming Hub 2');
    expect(result.canEditGeneral).toBe(true);
  });

  it('joins a public community when user is not yet a member', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', slug: 'gaming-hub', joinMode: 'PUBLIC' });
    prismaMock.communityMember.findUnique.mockResolvedValue(null);
    prismaMock.communityMember.create.mockResolvedValue(undefined);

    const result = await service.joinCommunityBySlug('user-1', 'gaming-hub');

    expect(prismaMock.communityMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId: 'community-1',
          userId: 'user-1',
          primaryRole: 'member',
          permissionLevel: 1,
        }),
      }),
    );
    expect(result.joined).toBe(true);
  });

  it('returns joined false when membership already exists', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', slug: 'gaming-hub', joinMode: 'PUBLIC' });
    prismaMock.communityMember.findUnique.mockResolvedValue({ userId: 'user-1' });

    const result = await service.joinCommunityBySlug('user-1', 'gaming-hub');

    expect(prismaMock.communityMember.create).not.toHaveBeenCalled();
    expect(result.joined).toBe(false);
  });

  it('rejects join for non-public communities', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', slug: 'midnight-lab', joinMode: 'REQUEST' });

    await expect(service.joinCommunityBySlug('user-1', 'midnight-lab')).rejects.toThrow(ForbiddenException);
    expect(prismaMock.communityMember.create).not.toHaveBeenCalled();
  });

  it('leaves a community when membership exists', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      slug: 'gaming-hub',
      ownerUserId: 'owner-1',
    });
    prismaMock.communityMember.findUnique.mockResolvedValue({ userId: 'user-1' });
    prismaMock.communityMember.delete.mockResolvedValue(undefined);

    const result = await service.leaveCommunityBySlug('user-1', 'gaming-hub');

    expect(prismaMock.communityMember.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          communityId_userId: {
            communityId: 'community-1',
            userId: 'user-1',
          },
        },
      }),
    );
    expect(result.left).toBe(true);
  });

  it('returns left false when membership does not exist', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      slug: 'gaming-hub',
      ownerUserId: 'owner-1',
    });
    prismaMock.communityMember.findUnique.mockResolvedValue(null);

    const result = await service.leaveCommunityBySlug('user-1', 'gaming-hub');

    expect(prismaMock.communityMember.delete).not.toHaveBeenCalled();
    expect(result.left).toBe(false);
  });

  it('rejects owner leaving their own community', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      slug: 'gaming-hub',
      ownerUserId: 'user-1',
    });

    await expect(service.leaveCommunityBySlug('user-1', 'gaming-hub')).rejects.toThrow(ForbiddenException);
  });

  it('deletes community when requester is owner', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      slug: 'gaming-hub',
      ownerUserId: 'user-1',
    });
    prismaMock.community.delete.mockResolvedValue(undefined);

    const result = await service.deleteCommunityBySlug('user-1', 'gaming-hub');

    expect(prismaMock.community.delete).toHaveBeenCalledWith({ where: { id: 'community-1' } });
    expect(result.deleted).toBe(true);
  });

  it('rejects delete when requester is not owner', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      slug: 'gaming-hub',
      ownerUserId: 'owner-1',
    });

    await expect(service.deleteCommunityBySlug('user-1', 'gaming-hub')).rejects.toThrow(ForbiddenException);
    expect(prismaMock.community.delete).not.toHaveBeenCalled();
  });

  it('creates community channel for member at create channel permission threshold', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.communityMember.findUnique.mockResolvedValue({ permissionLevel: 5 });
    prismaMock.channel.create.mockResolvedValue({
      id: 'channel-1',
      name: 'Raid Plans',
      requiredPermissionLevel: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.createCommunityChannel('user-1', 'gaming-hub', {
      name: 'Raid Plans',
      requiredPermissionLevel: 1,
    });

    expect(prismaMock.channel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId: 'community-1',
          name: 'Raid Plans',
          requiredPermissionLevel: 1,
          createdByUserId: 'user-1',
        }),
      }),
    );
    expect(result.name).toBe('Raid Plans');
  });

  it('rejects community channel create for member below create channel permission threshold', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.communityMember.findUnique.mockResolvedValue({ permissionLevel: 4 });

    await expect(
      service.createCommunityChannel('user-1', 'gaming-hub', {
        name: 'Raid Plans',
        requiredPermissionLevel: 1,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.channel.create).not.toHaveBeenCalled();
  });

  it('rejects community channel create for non-members', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.communityMember.findUnique.mockResolvedValue(null);

    await expect(
      service.createCommunityChannel('user-1', 'gaming-hub', {
        name: 'Raid Plans',
        requiredPermissionLevel: 1,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.channel.create).not.toHaveBeenCalled();
  });

  it('rejects community channel create with invalid name or required permission level', async () => {
    await expect(
      service.createCommunityChannel('user-1', 'gaming-hub', {
        name: '   ',
        requiredPermissionLevel: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createCommunityChannel('user-1', 'gaming-hub', {
        name: 'Raid Plans',
        requiredPermissionLevel: 11,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.community.findUnique).not.toHaveBeenCalled();
  });

  it('updates community channel name for member at edit channel permission threshold', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-1' });
    prismaMock.communityMember.findUnique.mockResolvedValue({ permissionLevel: 6 });
    prismaMock.channel.update.mockResolvedValue({
      id: 'channel-1',
      name: 'New Name',
      requiredPermissionLevel: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.updateCommunityChannel('user-1', 'gaming-hub', 'channel-1', { name: 'New Name' });

    expect(prismaMock.channel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'channel-1' },
        data: { name: 'New Name' },
      }),
    );
    expect(result.name).toBe('New Name');
  });

  it('rejects community channel update for member below edit channel permission threshold', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-1' });
    prismaMock.communityMember.findUnique.mockResolvedValue({ permissionLevel: 5 });

    await expect(
      service.updateCommunityChannel('user-1', 'gaming-hub', 'channel-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.channel.update).not.toHaveBeenCalled();
  });

  it('rejects community channel update for non-members', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-1' });
    prismaMock.communityMember.findUnique.mockResolvedValue(null);

    await expect(
      service.updateCommunityChannel('user-1', 'gaming-hub', 'channel-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.channel.update).not.toHaveBeenCalled();
  });

  it('rejects cross-community channel update as not found', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-2' });

    await expect(
      service.updateCommunityChannel('user-1', 'gaming-hub', 'channel-from-other-community', { name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.communityMember.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.channel.update).not.toHaveBeenCalled();
  });

  it('rejects community channel update with invalid name', async () => {
    await expect(
      service.updateCommunityChannel('user-1', 'gaming-hub', 'channel-1', { name: '   ' }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.community.findUnique).not.toHaveBeenCalled();
  });

  it('deletes community channel for member at delete channel permission threshold', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-1' });
    prismaMock.communityMember.findUnique.mockResolvedValue({ permissionLevel: 6 });
    prismaMock.channel.delete.mockResolvedValue({ id: 'channel-1' });

    const result = await service.deleteCommunityChannel('user-1', 'gaming-hub', 'channel-1');

    expect(prismaMock.channel.delete).toHaveBeenCalledWith({ where: { id: 'channel-1' } });
    expect(result).toEqual({ id: 'channel-1', deleted: true });
  });

  it('rejects community channel delete for member below delete channel permission threshold', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-1' });
    prismaMock.communityMember.findUnique.mockResolvedValue({ permissionLevel: 5 });

    await expect(
      service.deleteCommunityChannel('user-1', 'gaming-hub', 'channel-1'),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.channel.delete).not.toHaveBeenCalled();
  });

  it('rejects community channel delete for non-members', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-1' });
    prismaMock.communityMember.findUnique.mockResolvedValue(null);

    await expect(
      service.deleteCommunityChannel('user-1', 'gaming-hub', 'channel-1'),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.channel.delete).not.toHaveBeenCalled();
  });

  it('rejects cross-community channel delete as not found', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      permissionConfig: { createChannel: 5, editChannelName: 6, deleteChannel: 6, editGeneral: 9 },
    });
    prismaMock.channel.findUnique.mockResolvedValue({ communityId: 'community-2' });

    await expect(
      service.deleteCommunityChannel('user-1', 'gaming-hub', 'channel-from-other-community'),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.communityMember.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.channel.delete).not.toHaveBeenCalled();
  });
});
