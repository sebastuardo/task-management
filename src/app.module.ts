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
        const redisUrl = configService.get<string>(
          "REDIS_URL",
          "redis://localhost:6379"
        );

        try {
          const store = await redisStore({
            url: redisUrl,
            pingInterval: 5 * 1000,
          });

          console.log(`Redis connected successfully: ${redisUrl}`);

          return { store };
        } catch (error) {
          console.error(`Redis connection failed: ${redisUrl}`, error.message);
          throw error;
        }
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
