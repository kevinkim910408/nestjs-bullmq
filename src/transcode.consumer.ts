import { Process, Processor } from '@nestjs/bull';
import { TRANSCODE_QUEUE } from './constants';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AppService } from './app.service';

@Processor(TRANSCODE_QUEUE)
export class TranscodeConsumer {
  private readonly logger = new Logger(TranscodeConsumer.name);
  constructor(private readonly appService: AppService) {}

  @Process()
  async transcode(job: Job) {
    this.logger.log(JSON.stringify(job));
    if (job.data.message === 'freezeUsers') {
      await this.appService.freezeUsers();
    }
  }
}
