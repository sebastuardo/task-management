import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ActivitiesService } from "./activities.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly prisma: PrismaService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const taskId = request.params.id;

    if (method === "DELETE" && taskId) {
      return this.handleDeleteOperation(request, next);
    }

    let originalTaskPromise: Promise<any> | null = null;
    if (method === "PUT" && taskId) {
      originalTaskPromise = this.prisma.task
        .findUnique({
          where: { id: taskId },
        })
        .catch(() => null);
    }

    return next.handle().pipe(
      tap(async (response) => {
        setImmediate(async () => {
          try {
            await this.handleActivityLogging(
              method,
              request,
              response,
              originalTaskPromise
            );
          } catch (error) {
            console.error("Activity logging failed:", error);
          }
        });
      })
    );
  }

  private handleDeleteOperation(
    request: any,
    next: CallHandler
  ): Observable<any> {
    const taskId = request.params.id;
    const userId = this.extractUserId(request);

    setImmediate(async () => {
      try {
        await this.activitiesService.logTaskDeleted(taskId, userId);
      } catch (error) {
        console.error("Delete activity logging failed:", error);
      }
    });

    return next.handle();
  }

  private async handleActivityLogging(
    method: string,
    request: any,
    response: any,
    originalTaskPromise: Promise<any> | null
  ): Promise<void> {
    const userId = this.extractUserId(request);
    const taskId = request.params.id;

    switch (method) {
      case "POST":
        if (response?.id) {
          await this.activitiesService.logTaskCreated(response.id, userId);
        }
        break;

      case "PUT":
        if (taskId && originalTaskPromise) {
          const originalTask = await originalTaskPromise;
          if (originalTask) {
            const changes = this.detectChanges(originalTask, request.body);
            if (Object.keys(changes).length > 0) {
              await this.activitiesService.logTaskUpdated(
                taskId,
                userId,
                changes
              );
            }
          }
        }
        break;
    }
  }

  private extractUserId(request: any): string {
    return request.headers["x-user-id"] || "system";
  }

  private detectChanges(original: any, updated: any): Record<string, any> {
    const changes: Record<string, any> = {};

    const fieldsToTrack = [
      "title",
      "description",
      "status",
      "priority",
      "assigneeId",
      "projectId",
      "dueDate",
    ];

    for (const field of fieldsToTrack) {
      if (updated[field] !== undefined && updated[field] !== original[field]) {
        changes[field] = {
          from: original[field],
          to: updated[field],
        };
      }
    }

    return changes;
  }
}
