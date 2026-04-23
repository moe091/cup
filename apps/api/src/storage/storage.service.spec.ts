import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { storageConfig } from './storage.config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException } from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));
const getSignedUrlMock = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: storageConfig.KEY,
          useValue: {
            bucketName: 'test-bucket',
            region: 'us-east-1',
            envPrefix: 'test',
          },
        },
      ],
    }).compile();

    jest.clearAllMocks();
    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns an upload target for valid avatar requests', async () => {
    const userId = 'user-id-123';
    const mimeType = 'image/png';
    getSignedUrlMock.mockResolvedValue('https://example-signed-upload-url');
    const result = await service.createAvatarUploadTarget(userId, mimeType);
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(), // S3Client instance
      expect.anything(), // PutObjectCommand instance
      expect.objectContaining({ expiresIn: 120 }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        uploadUrl: 'https://example-signed-upload-url',
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        expiresInSeconds: 120,
      }),
    );
    expect(result.objectKey).toMatch(/^test\/avatars\/user-id-123\/.+\.png$/);
  });

  it('rejects unsupported avatar mime type', async () => {
    await expect(service.createAvatarUploadTarget('user-id-123', 'image/gif')).rejects.toThrow(BadRequestException);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it('rejects deleteObject when objectKey is empty', async () => {
    await expect(service.deleteObject('')).rejects.toThrow(BadRequestException);
  });

  it('deleteObject sends a delete command for valid object keys', async () => {
    const objectKey = 'test/avatars/user-id-123/old-avatar.png';
    const sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValueOnce({} as never);
    await service.deleteObject(objectKey);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    sendSpy.mockRestore();
  });
});
