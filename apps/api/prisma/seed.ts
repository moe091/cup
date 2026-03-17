import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
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

type CommunitySeed = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChannelSeed = {
  id: string;
  communityId: string | null;
  name: string;
  kind: 'COMMUNITY' | 'DM' | 'GAME_PAGE' | 'ROOM';
  visibility: 'PUBLIC' | 'PRIVATE';
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type CommunityMemberSeed = {
  communityId: string;
  userId: string;
  primaryRole: string;
  joinedAt: string;
};

type ChannelMemberSeed = {
  channelId: string;
  userId: string;
  source: 'MANUAL' | 'DERIVED';
  joinedAt: string;
};

type MessageSeed = {
  id: string;
  channelId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

type CustomEmojiSeed = {
  id: string;
  name: string;
  scopeType: 'GLOBAL' | 'COMMUNITY' | 'USER';
  scopeId: string | null;
  assetUrl: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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

function loadCommunitySeed(): CommunitySeed[] {
  const data = fs.readFileSync('prisma/seed-data/chat/communitySeed.json', 'utf-8');
  return JSON.parse(data) as CommunitySeed[];
}

function loadChannelSeed(): ChannelSeed[] {
  const data = fs.readFileSync('prisma/seed-data/chat/channelSeed.json', 'utf-8');
  return JSON.parse(data) as ChannelSeed[];
}

function loadCommunityMemberSeed(): CommunityMemberSeed[] {
  const data = fs.readFileSync('prisma/seed-data/chat/communityMemberSeed.json', 'utf-8');
  return JSON.parse(data) as CommunityMemberSeed[];
}

function loadChannelMemberSeed(): ChannelMemberSeed[] {
  const data = fs.readFileSync('prisma/seed-data/chat/channelMemberSeed.json', 'utf-8');
  return JSON.parse(data) as ChannelMemberSeed[];
}

function loadMessageSeed(): MessageSeed[] {
  const data = fs.readFileSync('prisma/seed-data/chat/messageSeed.json', 'utf-8');
  return JSON.parse(data) as MessageSeed[];
}

function loadCustomEmojiSeed(): CustomEmojiSeed[] {
  const data = fs.readFileSync('prisma/seed-data/chat/customEmojiSeed.json', 'utf-8');
  return JSON.parse(data) as CustomEmojiSeed[];
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
  const shouldSeedChat = mode !== 'base';
  const users = shouldSeedUsers ? loadUserSeed() : [];
  const communities = shouldSeedChat ? loadCommunitySeed() : [];
  const channels = shouldSeedChat ? loadChannelSeed() : [];
  const communityMembers = shouldSeedChat ? loadCommunityMemberSeed() : [];
  const channelMembers = shouldSeedChat ? loadChannelMemberSeed() : [];
  const messages = shouldSeedChat ? loadMessageSeed() : [];
  const customEmojis = shouldSeedChat ? loadCustomEmojiSeed() : [];
  const levels = [loadBouncerLevel('level1'), loadBouncerLevel('level2')];

  console.log(
    `[seed] mode=${mode} users=${users.length} communities=${communities.length} channels=${channels.length} communityMembers=${communityMembers.length} channelMembers=${channelMembers.length} messages=${messages.length} customEmojis=${customEmojis.length} levels=${levels.length}`,
  );

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

  for (const community of communities) {
    await prisma.community.upsert({
      where: { id: community.id },
      update: {
        name: community.name,
        description: community.description,
        slug: community.slug,
        ownerUserId: community.ownerUserId,
        createdAt: new Date(community.createdAt),
        updatedAt: new Date(community.updatedAt),
      },
      create: {
        id: community.id,
        name: community.name,
        description: community.description,
        slug: community.slug,
        ownerUserId: community.ownerUserId,
        createdAt: new Date(community.createdAt),
        updatedAt: new Date(community.updatedAt),
      },
    });
  }

  for (const channel of channels) {
    await prisma.channel.upsert({
      where: { id: channel.id },
      update: {
        communityId: channel.communityId,
        name: channel.name,
        kind: channel.kind,
        visibility: channel.visibility,
        createdByUserId: channel.createdByUserId,
        createdAt: new Date(channel.createdAt),
        updatedAt: new Date(channel.updatedAt),
      },
      create: {
        id: channel.id,
        communityId: channel.communityId,
        name: channel.name,
        kind: channel.kind,
        visibility: channel.visibility,
        createdByUserId: channel.createdByUserId,
        createdAt: new Date(channel.createdAt),
        updatedAt: new Date(channel.updatedAt),
      },
    });
  }

  for (const membership of communityMembers) {
    await prisma.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: membership.communityId,
          userId: membership.userId,
        },
      },
      update: {
        primaryRole: membership.primaryRole,
        joinedAt: new Date(membership.joinedAt),
      },
      create: {
        communityId: membership.communityId,
        userId: membership.userId,
        primaryRole: membership.primaryRole,
        joinedAt: new Date(membership.joinedAt),
      },
    });
  }

  for (const membership of channelMembers) {
    await prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId: membership.channelId,
          userId: membership.userId,
        },
      },
      update: {
        source: membership.source,
        joinedAt: new Date(membership.joinedAt),
      },
      create: {
        channelId: membership.channelId,
        userId: membership.userId,
        source: membership.source,
        joinedAt: new Date(membership.joinedAt),
      },
    });
  }

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {
        channelId: message.channelId,
        authorUserId: message.authorUserId,
        body: message.body,
        createdAt: new Date(message.createdAt),
        editedAt: message.editedAt ? new Date(message.editedAt) : null,
        deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
      },
      create: {
        id: message.id,
        channelId: message.channelId,
        authorUserId: message.authorUserId,
        body: message.body,
        createdAt: new Date(message.createdAt),
        editedAt: message.editedAt ? new Date(message.editedAt) : null,
        deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
      },
    });
  }

  for (const customEmoji of customEmojis) {
    await prisma.customEmoji.upsert({
      where: { id: customEmoji.id },
      update: {
        name: customEmoji.name,
        scopeType: customEmoji.scopeType,
        scopeId: customEmoji.scopeId,
        assetUrl: customEmoji.assetUrl,
        createdByUserId: customEmoji.createdByUserId,
        createdAt: new Date(customEmoji.createdAt),
        updatedAt: new Date(customEmoji.updatedAt),
        deletedAt: customEmoji.deletedAt ? new Date(customEmoji.deletedAt) : null,
      },
      create: {
        id: customEmoji.id,
        name: customEmoji.name,
        scopeType: customEmoji.scopeType,
        scopeId: customEmoji.scopeId,
        assetUrl: customEmoji.assetUrl,
        createdByUserId: customEmoji.createdByUserId,
        createdAt: new Date(customEmoji.createdAt),
        updatedAt: new Date(customEmoji.updatedAt),
        deletedAt: customEmoji.deletedAt ? new Date(customEmoji.deletedAt) : null,
      },
    });
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
