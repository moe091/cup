import { Controller, Get } from '@nestjs/common';

@Controller('games/bouncer')
export class BouncerController {
    constructor() {}

    @Get('join')
    getHello(): string {
        return 'This should return bouncer join info';
    }

    @Get('create')
    createMatch() {
        const matchInfo = {
            matchId: '111',
            endpoint: 'http://localhost:4001/bouncer'
        }

        return matchInfo;
    }
}

