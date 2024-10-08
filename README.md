# Nestjs와 Bullmq

- 메시지 큐를 만들때 사용 (무료, Redis 기반)
- 메시지 큐는 비동기 통신을 위한 프로토콜로, 응용 프로그램 간 메시지를 전송
- 메시지는 수신자가 처리할 때까지 대기열에 저장
- 큐에서 처리해야할 데이터들은 Job이라 표현.
- Redis가 작업의 상태 관리(예: 대기 중, 활성, 완료, 실패 등)도 담당
- Job은 처리 시작 시 'Active' 상태로, 성공 시 'Completed', 실패 시 'Failed' 상태.
- Bullmq는 기본적으로 FIFO로 작동하지만, LIFO도 지원함.
- 사용할수 있는 예시)
  - 매 시간마다 알림을 주는 기능
  - 대규모로 이메일발송, 업로드 등 처리할때 큐에 등록하고 처리가능
  - 데이터 크롤링도 여러 페이지에서 다양하게 병렬로 실행 가능.

### 설치

- nest js 설치

```
npm i -g @nestjs/cli
```

- nest project 생성

```
nest new
```

- nest js에 bull 설치

```
pnpm i @nestjs/bull bull
pnpm i @types/bull -D
```

### bull 과 redis 관계

- task queue에 보내질 메시지들을 유지할 기본 데이터 저장속 redis 이다.

### redis에 등록 코드

- transcode라는 이름으로 큐를 등록한다.
- app.module.ts

```js
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: TRANSCODE_QUEUE,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- 문자열은 const로 보관
- constant.ts

```js
export const TRANSCODE_QUEUE = 'transcode';
```

### 컨트롤러와 서비스 셋업

- 생성자로 큐를 생성: 큐에 비동기 작업을 추가하는 역활
- transcode 메소드: 생성된 큐에 파일을 변환하는 작업
- app.service.ts

```js
import { Inject, Injectable } from '@nestjs/common';
import { TRANSCODE_QUEUE } from './constants';
import { Queue } from 'bull';

@Injectable()
export class AppService {
  constructor(
    @Inject(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }
  async transcode() {
    await this.transcodeQueue.add({
      fileName: './file.mp3',
    });
  }
}
```

- 컨트롤러에서는 만들어진 해당 서비스를 불러줌.
- 큐에 새로운 작업을 추가해야해서 POST로 불러준다.
- app.controller.ts

```js
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
}
```

### 큐에서 작업을 처리하는 컨슈머 클래스 생성

- TRANSCODE_QUEUE 이 큐에서 작업을 꺼내서 사용.
- transcode 메소드에서 큐에서 꺼낸 작업을 처리할수 있음
- 지금은 job 로그만 보여줌.
- transcode.consumer.ts

```JS
import { Process, Processor } from '@nestjs/bull';
import { TRANSCODE_QUEUE } from './constants';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor(TRANSCODE_QUEUE)
export class TranscodeConsumer {
  private readonly logger = new Logger(TranscodeConsumer.name);

  @Process()
  async transcode(job: Job<unknown>) {
    this.logger.log(job);
  }
}
```

### 에러

```
[Nest] 22248  - 2024-08-08, 1:31:47 p.m.   ERROR [ExceptionHandler] Nest can't resolve dependencies of the AppService (?). Please make sure that the argument "transcode" at index [0] is available in the AppModule context.
```

- 이런 에러가 나는데, TranscodeConsumer가 TRANSCODE_QUEUE에서 작업을 컨슘하고, transcode 메소드에서 작업을 처리하게 설계가 되어있다 지금.
- 그런데 TRANSCODE_QUEUE이 큐가 작업을 처리하는 컨슈머 클래스에서 사용되는데 의존성이 주입이 되지 않아서 생긴 에러.
- AppModule에서 TRANSCODE_QUEUE와 연결을 해줘야함.

### 해결

- 서비스코드의 Inject를 InjectQueue로 변경해서 의존성 주입
  -app.service.ts

```js
import { Injectable } from '@nestjs/common';
import { TRANSCODE_QUEUE } from './constants';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }
  async transcode() {
    await this.transcodeQueue.add({
      fileName: './file.mp3',
    });
  }
}
```

- 이 컨슈머를 애플리케이션에 추가해서 Nest.js에게도 알려줌
- app.module.ts

```js
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bull';
import { TRANSCODE_QUEUE } from './constants';
import { TranscodeConsumer } from './transcode.consumer';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: TRANSCODE_QUEUE,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, TranscodeConsumer],
})
export class AppModule {}
```

### Redis 세팅및 요청 테스트

- postman으로 테스트 하려했지만,레디스가 실행이 되지 않아서 요청이 들어오지 않는다.
- 터미널 하나 더 열어주고, 도커 실행 레디스 이미지 기본 포트는 6379
  `docker run -p 6379:6379 redis`
- Ready to accept connections tcp가 뜨면 성공
- postman에서 POST로 http://localhost:3000/transcode에 send 했을때 201이 뜨면 성공
- Nest 터미널은 아래처럼 나와야함.

```
[Nest] 12364  - 2024-08-08, 1:43:36 p.m.     LOG [TranscodeConsumer] [object Object]
[Nest] 12364  - 2024-08-08, 1:43:37 p.m.     LOG [TranscodeConsumer] [object Object]
```

- 조금 더 자세한 기록이 보고싶으면, 컨슈머의 logger를 JSON으로 풀어줌

```js
import { Process, Processor } from '@nestjs/bull';
import { TRANSCODE_QUEUE } from './constants';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor(TRANSCODE_QUEUE)
export class TranscodeConsumer {
  private readonly logger = new Logger(TranscodeConsumer.name);

  @Process()
  async transcode(job: Job<unknown>) {
    this.logger.log(JSON.stringify(job));
  }
}
```

- 로거 예제

```
[Nest] 30456  - 2024-08-08, 1:44:43 p.m.     LOG [TranscodeConsumer] {"id":"3","name":"__default__","data":{"fileName":"./file.mp3"},"opts":{"attempts":1,"delay":0,"timestamp":1723139083952},"progress":0,"delay":0,"timestamp":1723139083952,"attemptsMade":0,"stacktrace":[],"returnvalue":null,"debounceId":null,"finishedOn":null,"processedOn":1723139083955}
```

- 보면 data 항목이 아까 서비스에서 작성한 내용인걸 확인가능.

### 매 1분마다 알림주는 기능

- 1분마다 큐에 알림을 주는 작업을 추가할 예정.
- 서비스에 repeat 기능을 이용해서 cron을 세팅한다
- app.service.ts

```js
import { Injectable } from '@nestjs/common';
import { TRANSCODE_QUEUE } from './constants';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}
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
}
```

- 컨트롤러에서는 해당 서비스를 부를수 있게 라우트를 만들어준다.

```js
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
}
```

- postman test: http://localhost:3000/send-notification
- 아래같은 로그가 1분마다 들어오면 성공.

```
[Nest] 21280  - 2024-08-08, 2:10:00 p.m.     LOG [TranscodeConsumer] {"id":"repeat:8c67330a4d444f9e84a1bb899165c85a:1723140600000","name":"__default__","data":{"message":"Notification"},"opts":{"repeat":{"count":2,"key":"__default__::::*/1 * * * *","cron":"*/1 * * * *"},"jobId":"repeat:8c67330a4d444f9e84a1bb899165c85a:1723140600000","delay":59987,"timestamp":1723140540013,"prevMillis":1723140600000,"attempts":1},"progress":0,"delay":0,"timestamp":1723140540013,"attemptsMade":0,"stacktrace":[],"returnvalue":null,"debounceId":null,"finishedOn":null,"processedOn":1723140600018}
```

### Bull Board 셋업

- Bull Board는 BullMQ와 Bull의 큐를 시각적으로 관리하고 모니터링할 수 있는 대시보드
- 설치 (https://www.npmjs.com/package/@bull-board/nestjs)

```
pnpm add --save @bull-board/nestjs @bull-board/api @bull-board/express
```

- module에 보드 추가
  -app.modules.ts

```js
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bull';
import { TRANSCODE_QUEUE } from './constants';
import { TranscodeConsumer } from './transcode.consumer';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullModule.registerQueue({
      name: TRANSCODE_QUEUE,
    }),
    BullBoardModule.forFeature({
      name: TRANSCODE_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, TranscodeConsumer],
})
export class AppModule {}
```

- 도커에서 redis 지우고 다시 실행 후에 http://localhost:3000/queues로 가서 체크
- postman으로 http://localhost:3000/send-notification 이 url 실행 후 job이 하나 추가되는지 체크
- 현재상황: 1 delayed (여기서 delayed는 예정된 스케쥴 이라는거임)
- 그리고 1분뒤 1개가 completed가 되고, 다른게 또 하나 delayed 되야함.
- 내 큐 이름이 transcode라서 transcode 라는 큐에 들어가는거임.

### 서버 시작하면 자동으로 큐 돌리게하기

- api 콜 안하고 시작하자마자 큐 돌리기
- 서비스에서 onModuleInit을 이용.
- app.service.ts

```js
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
```

- bull dashboard에 바로 delayed가 한개 들어와 있으면 성공
- 1분에 하나씩 completed되고 delayed 가 잘 되면 성공.

### Prisma 셋업

- 설치

```
pnpm install @prisma/client
pnpm install prisma --save-dev
```

- init

```
npx prisma init
```

- .env

```
DATABASE_URL="postgresql://postgres:123456@db:5432/testdb"
```

- 모델추가

```
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
```

- 기본 명령어 추가
- package.json

```
    "db:seed": "ts-node ./seed.ts",
    "db:studio": "npx prisma studio",
```

- prisma.service.ts

```js
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- prisma.module.ts

```js
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- app.module.ts에 모듈 추가

```js
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bull';
import { TRANSCODE_QUEUE } from './constants';
import { TranscodeConsumer } from './transcode.consumer';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullModule.registerQueue({
      name: TRANSCODE_QUEUE,
    }),
    BullBoardModule.forFeature({
      name: TRANSCODE_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, TranscodeConsumer],
})
export class AppModule {}
```

- Migrate 데이터베이스
- prisma 폴더안에 migrations가 있어야함, 이미 있으면 지우고 다시 해야함.

```
npx prisma migrate dev --name "init"
```

### seed

- root에 seed.ts 추가

```js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      {
        email: 'user1@example.com',
        name: 'User One',
      },
      {
        email: 'user2@example.com',
        name: 'User Two',
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- 커맨드 seed 실행, 그리고 studio도 실행해서 내부 체크
- 만약 다 맞으면, Nest.js 실행해서 http://localhost:3000/users 이 url Get해서 유저 두명 들어오는지 체크

### Docker 셋업

- docker-compose.yml 파일 생성

```
touch docker-compose.yml
```

- 내부

```
version: '3.8'
services:
  postgres:
    image: postgres:13.5
    restart: always
    environment:
      - POSTGRES_USER=myuser
      - POSTGRES_PASSWORD=mypassword
    volumes:
      - postgres:/var/lib/postgresql/data
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
volumes:
  postgres:
```

- package.json에 추가

```
"docker": "docker-compose up",
```

- 도커 없이 실행하면 http://localhost:3000/queues 여기에 job 있어선 안되고, 도커 실행하고 하면 job 있어야함.

### 일정 시간이 되면 user 컬렉션에 있는 데이터를 복사해서 다른 컬렉션에 freezing 하기

- 드디어 구현해야하는 메인 기능
- 모델 추가

```
model FreezedUser {
  id        Int      @id @default(autoincrement())
  email     String
  name      String?
  createdAt DateTime @default(now())
}
```

- 매번 마이그레이션 하기 쉽게 커맨드 추가

```
"db:migrate:dev": "pnpm prisma migrate dev",
```

- migrate 되면서 만약 db data 날아갔으면, seed 한번 더 해주고,
- app.service.ts에 이제 job을 jobName으로 구별하는 식의 코드 짜주고, freeze 코드 추가

```js
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
        repeat: { cron: '10 12 * * *' },
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

    await this.prisma.freezedUser.createMany({
      data: freezedUsers,
    });
  }
}
```

- 컨슈머에 jobName 받아서 freeze 실행하는거 추가

```js
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
```

- docker 실행하고, dev 실행하고, studio까지 실행해서 시간되면 복사 되는지 확인

### 여러 시간대에 각각 다르게 저장되는지 확인

- service에 작업을 추가해주고, db는 6개 이상 들어가지 않게 조절.

```js
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
```
