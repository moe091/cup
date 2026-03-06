import fs from 'node:fs';
import { PrismaClient } from '../src/generated/prisma/client';
import type { Prisma } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { hashPassword } from '../src/auth/password.util';

type UserSeed = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
};

type SeedMode = 'dev' | 'test' | 'base';

type BouncerSeedLevel = {
  name: string;
  objects: unknown[];
  gridSize?: number;
};

function loadBouncerLevel(name: string): BouncerSeedLevel {
  const data = fs.readFileSync(`prisma/seed-data/bouncer/${name}.json`, 'utf-8');
  const level = JSON.parse(data) as BouncerSeedLevel;

  return level;
}

function loadUserSeed(): UserSeed[] {
  const data = fs.readFileSync('prisma/seed-data/userSeed.json', 'utf-8');
  return JSON.parse(data) as UserSeed[];
}

function getSeedMode(argv: string[]): SeedMode {
  const modeArg = argv.find((arg) => arg.startsWith('--mode='));
  const rawMode = modeArg?.split('=')[1]?.trim().toLowerCase();

  if (!rawMode) {
    return 'dev';
  }

  if (rawMode === 'dev' || rawMode === 'test' || rawMode === 'base') {
    return rawMode;
  }

  throw new Error(`Invalid seed mode '${rawMode}'. Expected one of: dev, test, base.`);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const mode = getSeedMode(process.argv.slice(2));
  const shouldSeedUsers = mode !== 'base';
  const users = shouldSeedUsers ? loadUserSeed() : [];
  const levels = [loadBouncerLevel('level1'), loadBouncerLevel('level2')];

  console.log(`[seed] mode=${mode} users=${users.length} levels=${levels.length}`);

  for (const user of users) {
    const passwordHash = await hashPassword(user.password);

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        passwordHash,
      },
      create: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        passwordHash,
      },
    });
  }

  for (const level of levels) {
    const existing = await prisma.bouncerLevel.findFirst({
      where: { ownerUserId: null, name: level.name },
    });

    if (existing) {
      //don't wanna overwrite levels rn just in case
      await prisma.bouncerLevel.update({
        where: { id: existing.id },
        data: {
          data: level as Prisma.InputJsonValue,
          visibility: 'SYSTEM',
          id: `seeded-id-${level.name}`,
        },
      });
    } else {
      await prisma.bouncerLevel.create({
        data: {
          id: `seeded-id-${level.name}`,
          name: level.name,
          data: level as Prisma.InputJsonValue,
          visibility: 'SYSTEM',
          ownerUserId: null,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
