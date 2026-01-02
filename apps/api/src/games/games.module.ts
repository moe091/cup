import { Module } from '@nestjs/common';
import { BouncerModule } from './bouncer/bouncer.module';

@Module({
  imports: [BouncerModule]
})
export class GamesModule {}
