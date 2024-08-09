import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('transcode')
  async transcode() {
    return this.appService.transcode();
  }

  @Post('send-notification')
  async sendNotification() {
    return this.appService.sendHourlyNotification();
  }
  @Get('users')
  async getAllUsers() {
    return this.appService.getAllUsers();
  }
}
