import { Module } from '@nestjs/common';
import { BouncerController } from './bouncer.controller';

@Module({
  controllers: [BouncerController]
})
export class BouncerModule {}
