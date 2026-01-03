import { Controller, Get, Param, Post } from '@nestjs/common';

@Controller('games/bouncer')
export class BouncerController {
    constructor() {}

    @Post('join/:matchId')
    joinMatch(@Param('matchId') matchId: string) {
        // do a bunch of stuff to check if match exists, is full, etc.

        return { matchId }; // add ticket to this eventually
    }

    @Post('create')
    createMatch() {
        const matchInfo = {
            matchId: '111',
            endpoint: 'http://localhost:4001/bouncer' //TODO:: possibly remove this, don't think it's needed here
        }

        return matchInfo;
    }
}

