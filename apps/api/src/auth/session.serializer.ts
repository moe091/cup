import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { PrismaService } from 'src/prisma/prisma.service';
import type { SessionUser } from '@cup/shared-types';

// NOTE: serialize by user id only. deserialize automatically uses id to find user in db and return id, email, and displayName. Can add more fields to deserialize later if needed
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  serializeUser(user: SessionUser, done: (err: Error | null, id?: string) => void) {
    console.log('Serializing user:', user);
    done(null, user.id);
  }

  async deserializeUser(id: string, done: (err: Error | null, user?: SessionUser | null) => void) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });
      console.log('Deserializing user with id:', id, 'Found user:', user);
      if (!user) return done(null, null);
      done(null, {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (err) {
      done(err as Error, null);
    }
  }
}
