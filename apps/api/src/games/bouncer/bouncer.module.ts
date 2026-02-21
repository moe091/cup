import { Module } from '@nestjs/common';
import { BouncerController } from './bouncer.controller';
import { LobbyService } from '../lobby/lobby.service';
import { BouncerService } from './bouncer.service';

@Module({
  controllers: [BouncerController],
  providers: [LobbyService, BouncerService],
})
export class BouncerModule {}
