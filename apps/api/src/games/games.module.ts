import { Module } from '@nestjs/common';
import { BouncerModule } from './bouncer/bouncer.module';
import { SpellDuelModule } from './spellduel/spellduel.module';
import { LobbyService } from './lobby/lobby.service';

@Module({
  imports: [BouncerModule, SpellDuelModule],
  providers: [LobbyService],
})
export class GamesModule {}
