import { Injectable } from '@nestjs/common';
import { Profile } from 'passport-google-oauth20';
import { SessionUser } from '@cup/shared-types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) {}

    
    async validateGoogleUser(profile: Profile): Promise<SessionUser> {
        if (!profile.emails || profile.emails.length === 0) {
            throw new Error('No email found in Google profile');
        }

        const provider = 'google';
        const providerId = profile.id;
        const email = profile.emails[0].value;
        const displayName = profile.displayName || email || 'Unknown';
        
        //query db for user based on id+provider
        const existingUser = await this.prisma.oAuthAccount.findUnique({
            where: {provider_providerAccountId: {
                provider: provider,
                providerAccountId: providerId
            }},
            include: { user: true }
        });
        //if user already exists, just return user info
        if (existingUser) {
            return {
                id: existingUser.user.id,
                email: existingUser.user.email,
                displayName: existingUser.user.displayName
            };
        }

        //if user doesn't exist, create db entries for user and oAuthAccount
        const newUser = await this.prisma.user.create({
            data: { email: email || '', displayName }
        });

        await this.prisma.oAuthAccount.create({
            data: {
                provider, 
                providerAccountId: providerId,
                userId: newUser.id
            }, 
        });

        

        return {
            id: newUser.id,
            email: newUser.email,
            displayName: newUser.displayName
        };


    }
}
