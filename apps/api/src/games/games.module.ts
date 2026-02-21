import { Module } from '@nestjs/common';
import { BouncerModule } from './bouncer/bouncer.module';
import { LobbyService } from './lobby/lobby.service';

@Module({
  imports: [BouncerModule],
  providers: [LobbyService],
})
export class GamesModule {}
