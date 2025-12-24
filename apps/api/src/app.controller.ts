import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DbService } from './db.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly dbService: DbService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('message')
  async getMessage() {
    const message = await this.dbService.getHelloMessage();
    return { message: message || 'missing'}
  }

  @Get('health')
  checkHealth(): { status: string } {
    return { status: 'OK' };
  }
}
