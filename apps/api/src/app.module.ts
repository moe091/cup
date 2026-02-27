import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';
import { UsersModule } from './users/users.module';
import { CsrfMiddleware } from './security/csrf.middleware';
import { RateLimitMiddleware } from './security/rate-limit.middleware';

@Module({
  imports: [PrismaModule, AuthModule, GamesModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RateLimitMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
