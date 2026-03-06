import { ChatTokenResponse } from '@cup/shared-types';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const CHAT_TOKEN_TTL_SECONDS = 10 * 60;

@Injectable()
export class ChatService {

    issueConnectionToken(userId: string): ChatTokenResponse {
        const secret = process.env.CHAT_TOKEN_SECRET;
        if (!secret) { 
            throw new InternalServerErrorException('CHAT_TOKEN_SECRET is not configured');
        }

        const token = jwt.sign(
            { sub: userId, ver: 1 },
            secret,
            {
                algorithm: 'HS256',
                expiresIn: CHAT_TOKEN_TTL_SECONDS,
                audience: 'chat',
                issuer: 'cup-api',
            },
        );

        return {
            token,
            expiresInSeconds: CHAT_TOKEN_TTL_SECONDS,
        };
    }
}