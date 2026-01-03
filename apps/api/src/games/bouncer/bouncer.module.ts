import { Module } from '@nestjs/common';
import { BouncerController } from './bouncer.controller';
import { LobbyService } from '../lobby/lobby.service';

@Module({
  controllers: [BouncerController],
  providers: [LobbyService],
})
export class BouncerModule {}
