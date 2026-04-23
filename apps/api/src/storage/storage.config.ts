import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => {
  const bucketName = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  if (!bucketName || !region) {
    throw new Error('Missing required storage env vars');
  }
  return {
    bucketName,
    region,
    envPrefix: process.env.S3_ENV_PREFIX ?? 'dev',
  };
});
