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
      update: jest.Mock;
    };
    communityMember: {
      findMany: jest.Mock;
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
        update: jest.fn(),
      },
      communityMember: {
        findMany: jest.fn(),
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
});
