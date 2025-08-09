import { Module } from "@nestjs/common";
import { ActivitiesService } from "./activities.service";
import { ActivityTrackerService } from "./activity-tracker.service";
import {
  ActivitiesController,
  TaskActivitiesController,
} from "./activities.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ActivitiesController, TaskActivitiesController],
  providers: [ActivitiesService, ActivityTrackerService],
  exports: [ActivitiesService, ActivityTrackerService],
})
export class ActivitiesModule {}
