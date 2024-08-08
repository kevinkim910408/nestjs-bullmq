import { Injectable } from '@nestjs/common';
import { TRANSCODE_QUEUE } from './constants';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}
  async onModuleInit() {
    this.scheduleNotifications();
  }
  getHello(): string {
    return 'Hello World!';
  }
  async transcode() {
    await this.transcodeQueue.add({
      fileName: './file.mp3',
    });
  }
  async sendHourlyNotification() {
    await this.transcodeQueue.add(
      {
        message: 'sendHourlyNotification',
      },
      {
        repeat: { cron: '*/1 * * * *' },
      },
    );
  }
  async scheduleNotifications() {
    await this.transcodeQueue.add(
      {
        message: 'scheduleNotifications',
      },
      {
        repeat: { cron: '*/1 * * * *' },
      },
    );
  }
}
