import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { storageConfig } from './storage.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forFeature(storageConfig)],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
