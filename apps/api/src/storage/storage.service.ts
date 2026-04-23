import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AvatarUploadTargetResponse } from '@cup/shared-types';
import type { ConfigType } from '@nestjs/config';
import { storageConfig } from './storage.config';

const AVATAR_UPLOAD_EXPIRES_SECONDS = 120;
const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const AVATAR_FEATURE_PREFIX = 'avatars';

@Injectable()
export class StorageService {
  constructor(@Inject(storageConfig.KEY) private readonly storage: ConfigType<typeof storageConfig>) {}

  async createAvatarUploadTarget(userId: string, mimeType: string): Promise<AvatarUploadTargetResponse> {
    const extension = AVATAR_EXTENSION_BY_MIME[mimeType];
    if (!extension) {
      throw new BadRequestException(`Unsupported avatar mimeType: ${mimeType}`);
    }

    const objectKey = `${this.storage.envPrefix}/${AVATAR_FEATURE_PREFIX}/${userId}/${randomUUID()}.${extension}`;

    const s3 = new S3Client({ region: this.storage.region });

    const command = new PutObjectCommand({
      Bucket: this.storage.bucketName,
      Key: objectKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: AVATAR_UPLOAD_EXPIRES_SECONDS,
    });

    return {
      uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      objectKey,
      expiresInSeconds: AVATAR_UPLOAD_EXPIRES_SECONDS,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    if (!objectKey.trim()) {
      throw new BadRequestException('objectKey is required');
    }

    const s3 = new S3Client({ region: this.storage.region });

    await s3.send(
      new DeleteObjectCommand({
        Bucket: this.storage.bucketName,
        Key: objectKey,
      }),
    );
  }
}
