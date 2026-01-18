import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

function loadLevel(name) {
    const data = fs.readFileSync("prisma/seed-data/bouncer/" + name + ".json", "utf-8");
    const level = JSON.parse(data);

    return level;
}

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });



async function main() {
  const levels = [loadLevel('level1'), loadLevel('level2')];

  for (const level of levels) {
    const existing = await prisma.bouncerLevel.findFirst({
      where: { ownerUserId: null, name: level.name },
    });

    if (existing) { //don't wanna overwrite levels rn just in case
      await prisma.bouncerLevel.update({
        where: { id: existing.id },
        data: {
          data: level,
          visibility: 'SYSTEM',
          id: `seeded-id-${level.name}`,
        },
      });
    } else {
      await prisma.bouncerLevel.create({
        data: {
          id: `seeded-id-${level.name}`,
          name: level.name,
          data: level,
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