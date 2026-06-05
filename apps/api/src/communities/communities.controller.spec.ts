import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { CreateCommunityRequestDto } from '@cup/shared-types';
import type { AuthedRequest } from 'src/auth/auth.types';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;
  let communitiesServiceMock: {
    createCommunity: jest.Mock;
    getMyCommunities: jest.Mock;
    getPublicCommunities: jest.Mock;
    getCommunitySettingsBySlug: jest.Mock;
    updateCommunitySettingsBySlug: jest.Mock;
    joinCommunityBySlug: jest.Mock;
    leaveCommunityBySlug: jest.Mock;
    deleteCommunityBySlug: jest.Mock;
    requestCommunityIconUploadTarget: jest.Mock;
    updateCommunityIcon: jest.Mock;
    createCommunityChannel: jest.Mock;
    updateCommunityChannel: jest.Mock;
    deleteCommunityChannel: jest.Mock;
  };

  beforeEach(async () => {
    communitiesServiceMock = {
      createCommunity: jest.fn(),
      getMyCommunities: jest.fn(),
      getPublicCommunities: jest.fn(),
      getCommunitySettingsBySlug: jest.fn(),
      updateCommunitySettingsBySlug: jest.fn(),
      joinCommunityBySlug: jest.fn(),
      leaveCommunityBySlug: jest.fn(),
      deleteCommunityBySlug: jest.fn(),
      requestCommunityIconUploadTarget: jest.fn(),
      updateCommunityIcon: jest.fn(),
      createCommunityChannel: jest.fn(),
      updateCommunityChannel: jest.fn(),
      deleteCommunityChannel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunitiesController],
      providers: [{ provide: CommunitiesService, useValue: communitiesServiceMock }],
    }).compile();

    controller = module.get<CommunitiesController>(CommunitiesController);
  });

  it('creates a community for authenticated user', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    const payload: CreateCommunityRequestDto = { name: 'My Community', joinMode: 'PUBLIC', description: null };
    communitiesServiceMock.createCommunity.mockResolvedValue({ id: 'community-1', slug: 'my-community' });

    await controller.createCommunity(req, payload);

    expect(communitiesServiceMock.createCommunity).toHaveBeenCalledWith('user-1', payload);
  });

  it('rejects create community when unauthenticated', async () => {
    const payload: CreateCommunityRequestDto = { name: 'x', joinMode: 'PUBLIC', description: null };
    expect(() =>
      controller.createCommunity({} as AuthedRequest, payload),
    ).toThrow(UnauthorizedException);
  });

  it('requests community icon upload target for authenticated owner', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    const payload = { mimeType: 'image/png', sizeBytes: 1024 };
    communitiesServiceMock.requestCommunityIconUploadTarget.mockResolvedValue({
      uploadUrl: 'https://upload',
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      objectKey: 'dev/communities/community-1/icon.png',
      expiresInSeconds: 120,
    });

    await controller.requestCommunityIconUploadTarget('community-1', req, payload);

    expect(communitiesServiceMock.requestCommunityIconUploadTarget).toHaveBeenCalledWith('user-1', 'community-1', payload);
  });

  it('returns public communities for unauthenticated viewer', async () => {
    const query = { search: 'dog', limit: '20' };
    communitiesServiceMock.getPublicCommunities.mockResolvedValue({ items: [], nextCursor: null });

    await controller.getPublicCommunities(query, {} as AuthedRequest);

    expect(communitiesServiceMock.getPublicCommunities).toHaveBeenCalledWith(query, undefined);
  });

  it('returns community settings for viewer', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    communitiesServiceMock.getCommunitySettingsBySlug.mockResolvedValue({ id: 'community-1' });

    await controller.getCommunitySettingsBySlug('gaming-hub', req);

    expect(communitiesServiceMock.getCommunitySettingsBySlug).toHaveBeenCalledWith('gaming-hub', 'user-1');
  });

  it('updates community settings for authenticated editor', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    const payload = { name: 'Gaming Hub', description: 'desc', joinMode: 'PUBLIC' as const };
    communitiesServiceMock.updateCommunitySettingsBySlug.mockResolvedValue({ id: 'community-1' });

    await controller.updateCommunitySettingsBySlug('gaming-hub', req, payload);

    expect(communitiesServiceMock.updateCommunitySettingsBySlug).toHaveBeenCalledWith('user-1', 'gaming-hub', payload);
  });

  it('rejects settings update when unauthenticated', async () => {
    const payload = { name: 'Gaming Hub', description: 'desc', joinMode: 'PUBLIC' as const };
    expect(() => controller.updateCommunitySettingsBySlug('gaming-hub', {} as AuthedRequest, payload)).toThrow(UnauthorizedException);
  });

  it('updates community icon for authenticated owner', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    const payload = { iconKey: 'dev/communities/community-1/icon.png' };
    communitiesServiceMock.updateCommunityIcon.mockResolvedValue({ id: 'community-1' });

    await controller.updateCommunityIcon('community-1', req, payload);

    expect(communitiesServiceMock.updateCommunityIcon).toHaveBeenCalledWith('user-1', 'community-1', payload);
  });

  it('joins a community for authenticated user', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    communitiesServiceMock.joinCommunityBySlug.mockResolvedValue({
      communityId: 'community-1',
      slug: 'gaming-hub',
      joined: true,
    });

    await controller.joinCommunityBySlug('gaming-hub', req);

    expect(communitiesServiceMock.joinCommunityBySlug).toHaveBeenCalledWith('user-1', 'gaming-hub');
  });

  it('rejects join when unauthenticated', async () => {
    expect(() => controller.joinCommunityBySlug('gaming-hub', {} as AuthedRequest)).toThrow(UnauthorizedException);
  });

  it('leaves a community for authenticated user', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    communitiesServiceMock.leaveCommunityBySlug.mockResolvedValue({
      communityId: 'community-1',
      slug: 'gaming-hub',
      left: true,
    });

    await controller.leaveCommunityBySlug('gaming-hub', req);

    expect(communitiesServiceMock.leaveCommunityBySlug).toHaveBeenCalledWith('user-1', 'gaming-hub');
  });

  it('rejects leave when unauthenticated', async () => {
    expect(() => controller.leaveCommunityBySlug('gaming-hub', {} as AuthedRequest)).toThrow(UnauthorizedException);
  });

  it('deletes a community for authenticated owner', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    communitiesServiceMock.deleteCommunityBySlug.mockResolvedValue({
      communityId: 'community-1',
      slug: 'gaming-hub',
      deleted: true,
    });

    await controller.deleteCommunityBySlug('gaming-hub', req);

    expect(communitiesServiceMock.deleteCommunityBySlug).toHaveBeenCalledWith('user-1', 'gaming-hub');
  });

  it('rejects delete when unauthenticated', async () => {
    expect(() => controller.deleteCommunityBySlug('gaming-hub', {} as AuthedRequest)).toThrow(UnauthorizedException);
  });

  it('creates a channel for authenticated user', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    const payload = { name: 'Raid Plans', requiredPermissionLevel: 1 };
    communitiesServiceMock.createCommunityChannel.mockResolvedValue({ id: 'channel-1' });

    await controller.createChannel('gaming-hub', req, payload);

    expect(communitiesServiceMock.createCommunityChannel).toHaveBeenCalledWith('user-1', 'gaming-hub', payload);
  });

  it('rejects channel create when unauthenticated', async () => {
    const payload = { name: 'Raid Plans', requiredPermissionLevel: 1 };

    expect(() => controller.createChannel('gaming-hub', {} as AuthedRequest, payload)).toThrow(UnauthorizedException);
  });

  it('updates a channel for authenticated user', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    const payload = { name: 'New Name' };
    communitiesServiceMock.updateCommunityChannel.mockResolvedValue({ id: 'channel-1' });

    await controller.updateChannel('gaming-hub', 'channel-1', req, payload);

    expect(communitiesServiceMock.updateCommunityChannel).toHaveBeenCalledWith('user-1', 'gaming-hub', 'channel-1', payload);
  });

  it('rejects channel update when unauthenticated', async () => {
    const payload = { name: 'New Name' };

    expect(() => controller.updateChannel('gaming-hub', 'channel-1', {} as AuthedRequest, payload)).toThrow(UnauthorizedException);
  });

  it('deletes a channel for authenticated user', async () => {
    const req = { user: { id: 'user-1' } } as AuthedRequest;
    communitiesServiceMock.deleteCommunityChannel.mockResolvedValue({ id: 'channel-1', deleted: true });

    await controller.deleteChannel('gaming-hub', 'channel-1', req);

    expect(communitiesServiceMock.deleteCommunityChannel).toHaveBeenCalledWith('user-1', 'gaming-hub', 'channel-1');
  });

  it('rejects channel delete when unauthenticated', async () => {
    expect(() => controller.deleteChannel('gaming-hub', 'channel-1', {} as AuthedRequest)).toThrow(UnauthorizedException);
  });
});
