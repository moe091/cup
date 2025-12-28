import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthedRequest } from './auth.types';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return a SessionUser when /me is called with an authenticated request', () => {
    const req = {
      user: {
        id: 'user-id-123',
        email: 'fake@example.com',
        displayName: 'Fake User',
      },
    } as AuthedRequest;

    const result = controller.me(req);

    expect(result).toEqual({
      id: 'user-id-123',
      email: 'fake@example.com',
      displayName: 'Fake User',
    });
  });

  it('should throw UnauthorizedException when /me is called without an authenticated request', () => {
    const req = {} as AuthedRequest;

    expect(() => controller.me(req)).toThrow(UnauthorizedException);
  });
});
