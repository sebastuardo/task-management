import { ActivityAction } from "@prisma/client";

export class ActivityResponseDto {
  id: string;
  taskId: string | null;
  taskTitle: string;
  userId: string;
  userName: string;
  action: ActivityAction;
  changes?: Record<string, { old: any; new: any }>;
  createdAt: Date;
}

export class PaginatedActivityResponseDto {
  data: ActivityResponseDto[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
