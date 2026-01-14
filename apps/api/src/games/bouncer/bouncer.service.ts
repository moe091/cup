import { LevelDefinition } from '@cup/bouncer-shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BouncerService {
  constructor(private readonly prisma: PrismaService) {}

  async getLevelByUser(ownerUserId: string, name: string) {
    const level = await this.prisma.bouncerLevel.findFirst({
      where: { name, ownerUserId },
    });
    if (!level) throw new NotFoundException();

    return level;
  }

  async getSystemLevel(name: string) {
    const level = await this.prisma.bouncerLevel.findFirst({
        where: { name, visibility: 'SYSTEM' }
    });
    if (!level) throw new NotFoundException();

    return level;
  }

  async saveLevel(userId: string, name: string, data: LevelDefinition) {
    const levelRow = await this.prisma.bouncerLevel.upsert({
      where: { ownerUserId_name: { ownerUserId: userId, name } },
      update: { data },
      create: { name, data, ownerUserId: userId },
    });

    console.log('Created level row: ', levelRow.id);
    return levelRow.id;
  }

  async listLevelsByUser(userId: string, includeSystem: boolean) {
    const or: Array<Record<string, unknown>> = [{ ownerUserId: userId }];
    if (includeSystem) or.push({ visibility: 'SYSTEM' });

    return this.prisma.bouncerLevel.findMany({
      where: { OR: or },
      select: { id: true, name: true, visibility: true, ownerUserId: true, updatedAt: true },
    });
  }

  async listSystemLevels() {
    const levels = await this.prisma.bouncerLevel.findMany({
      where: { visibility: 'SYSTEM' },
      select: { id: true, name: true, visibility: true, ownerUserId: true, updatedAt: true },
    });

    return levels;
  }
}
