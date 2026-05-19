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
    joinCommunityBySlug: jest.Mock;
    leaveCommunityBySlug: jest.Mock;
    deleteCommunityBySlug: jest.Mock;
    requestCommunityIconUploadTarget: jest.Mock;
    updateCommunityIcon: jest.Mock;
  };

  beforeEach(async () => {
    communitiesServiceMock = {
      createCommunity: jest.fn(),
      getMyCommunities: jest.fn(),
      getPublicCommunities: jest.fn(),
      joinCommunityBySlug: jest.fn(),
      leaveCommunityBySlug: jest.fn(),
      deleteCommunityBySlug: jest.fn(),
      requestCommunityIconUploadTarget: jest.fn(),
      updateCommunityIcon: jest.fn(),
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
});
