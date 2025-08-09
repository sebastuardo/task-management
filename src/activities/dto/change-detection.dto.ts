export interface FieldChange {
  old: any;
  new: any;
}

export interface TaskChanges {
  [fieldName: string]: FieldChange;
}

export class TaskComparisonDto {
  taskId: string;
  userId: string;
  changes: TaskChanges;

  constructor(taskId: string, userId: string, changes: TaskChanges) {
    this.taskId = taskId;
    this.userId = userId;
    this.changes = changes;
  }

  hasChanges(): boolean {
    return Object.keys(this.changes).length > 0;
  }
}
