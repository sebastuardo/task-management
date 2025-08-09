import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { TaskCacheService } from "./task-cache.service";
import { TaskQueryBuilder } from "./task-query-builder.service";
import { EmailModule } from "../email/email.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [EmailModule, PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, TaskCacheService, TaskQueryBuilder],
})
export class TasksModule {}
