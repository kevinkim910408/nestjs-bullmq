import { Injectable } from '@nestjs/common';
import { TRANSCODE_QUEUE } from './constants';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}
  async onModuleInit() {
    this.scheduledTasks();
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
  async scheduledTasks() {
    await this.transcodeQueue.add(
      {
        jobName: 'sendNotifications',
      },
      {
        repeat: { cron: '*/1 * * * *' },
      },
    );

    await this.transcodeQueue.add(
      {
        message: 'freezeUsers',
      },
      {
        repeat: { cron: '30 13 * * *' },
      },
    );

    await this.transcodeQueue.add(
      {
        message: 'freezeUsers',
      },
      {
        repeat: { cron: '31 13 * * *' },
      },
    );

    await this.transcodeQueue.add(
      {
        message: 'freezeUsers',
      },
      {
        repeat: { cron: '32 13 * * *' },
      },
    );
  }
  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async freezeUsers() {
    const users = await this.prisma.user.findMany();
    const freezedUsers = users.map((user) => ({
      email: user.email,
      name: user.name,
    }));

    const currentCount = await this.prisma.freezedUser.count();

    if (currentCount >= 6) {
      const excessCount = currentCount + freezedUsers.length - 6;

      if (excessCount > 0) {
        const oldestUsers = await this.prisma.freezedUser.findMany({
          orderBy: { createdAt: 'asc' },
          take: excessCount,
        });

        await Promise.all(
          oldestUsers.map((user) =>
            this.prisma.freezedUser.delete({ where: { id: user.id } }),
          ),
        );
      }
    }

    await this.prisma.freezedUser.createMany({
      data: freezedUsers,
    });
  }
}
