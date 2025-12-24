import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma, User } from '../generated/prisma/client';


@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async User(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput
  ): Promise<User | null> {
    return this.prisma.user.findUnique({where: userWhereUniqueInput});
  }

  

}

