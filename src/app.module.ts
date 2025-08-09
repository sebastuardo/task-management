import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { PrismaModule } from "./prisma/prisma.module";
import { TasksModule } from "./tasks/tasks.module";
import { ProjectsModule } from "./projects/projects.module";
import { UsersModule } from "./users/users.module";
import { EmailModule } from "./email/email.module";
import { redisStore } from "cache-manager-redis-yet";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>("REDIS_HOST", "localhost");
        const redisPort = configService.get<number>("REDIS_PORT", 6379);

        return {
          store: await redisStore({
            url: `redis://${redisHost}:${redisPort}`,
            pingInterval: 5 * 1000,
          }),
        };
      },
    }),
    PrismaModule,
    TasksModule,
    ProjectsModule,
    UsersModule,
    EmailModule,
  ],
})
export class AppModule {}
