import { ActivityAction } from "@prisma/client";
import { TaskChanges } from "./change-detection.dto";

export class CreateActivityDto {
  taskId: string | null;
  userId: string;
  action: ActivityAction;
  changes?: TaskChanges;

  constructor(
    taskId: string | null,
    userId: string,
    action: ActivityAction,
    changes?: TaskChanges
  ) {
    this.taskId = taskId;
    this.userId = userId;
    this.action = action;
    this.changes = changes;
  }
}
