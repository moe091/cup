import { Module } from '@nestjs/common';
import { SpellDuelController } from './spellduel.controller';
import { LobbyService } from '../lobby/lobby.service';

@Module({
  controllers: [SpellDuelController],
  providers: [LobbyService],
})
export class SpellDuelModule {}
