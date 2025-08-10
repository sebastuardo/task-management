import { Injectable, NotFoundException } from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskFilterDto } from "./dto/task-filter.dto";
import { TaskCacheService } from "./task-cache.service";
import { TaskQueryBuilder } from "./task-query-builder.service";

@Injectable()
export class TasksService {
  constructor(
    private emailService: EmailService,
    private taskCache: TaskCacheService,
    private taskQuery: TaskQueryBuilder
  ) {}

  async findAll(filterDto: TaskFilterDto) {
    const cacheKey = this.taskCache.generateListCacheKey(filterDto);

    try {
      const tasks = await this.taskCache.wrapTaskQuery(
        cacheKey,
        () => this.taskQuery.executeTaskListQuery(filterDto),
        this.taskCache.TASK_LIST_TTL
      );

      return tasks;
    } catch (error) {
      console.error("Cache error in findAll, using fallback:", error.message);
      return this.taskQuery.executeTaskListQuery(filterDto);
    }
  }

  async findOne(id: string) {
    const cacheKey = this.taskCache.generateItemCacheKey(id);

    try {
      const task = await this.taskCache.wrapTaskQuery(
        cacheKey,
        async () => {
          const task = await this.taskQuery.executeTaskQuery(id);

          if (!task) {
            throw new NotFoundException(`Task with ID ${id} not found`);
          }

          return task;
        },
        this.taskCache.TASK_ITEM_TTL
      );

      return task;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Cache error in findOne, using fallback:", error.message);

      const task = await this.taskQuery.executeTaskQuery(id);

      if (!task) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      return task;
    }
  }

  async create(createTaskDto: CreateTaskDto) {
    const taskData = {
      title: createTaskDto.title,
      description: createTaskDto.description,
      status: createTaskDto.status,
      priority: createTaskDto.priority,
      dueDate: createTaskDto.dueDate,
      project: { connect: { id: createTaskDto.projectId } },
      assignee: createTaskDto.assigneeId
        ? { connect: { id: createTaskDto.assigneeId } }
        : undefined,
      tags: createTaskDto.tagIds
        ? { connect: createTaskDto.tagIds.map((id) => ({ id })) }
        : undefined,
    };

    const task = await this.taskQuery.createTask(taskData);

    await this.taskCache.cacheTask(task.id, task);
    await this.taskCache.invalidateListCaches();

    if (task.assignee) {
      this.emailService
        .sendTaskAssignmentNotification(task.assignee.email, task.title)
        .catch((error) => {
          console.error("Failed to send task assignment notification:", error);
        });
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const existingTask = await this.findOne(id);

    const updateData = {
      title: updateTaskDto.title,
      description: updateTaskDto.description,
      status: updateTaskDto.status,
      priority: updateTaskDto.priority,
      dueDate: updateTaskDto.dueDate,
      assignee:
        updateTaskDto.assigneeId !== undefined
          ? updateTaskDto.assigneeId
            ? { connect: { id: updateTaskDto.assigneeId } }
            : { disconnect: true }
          : undefined,
      tags: updateTaskDto.tagIds
        ? { set: updateTaskDto.tagIds.map((id) => ({ id })) }
        : undefined,
    };

    const task = await this.taskQuery.updateTask(id, updateData);

    await this.taskCache.invalidateTaskCaches(id);

    if (
      updateTaskDto.assigneeId &&
      updateTaskDto.assigneeId !== (existingTask as any).assigneeId
    ) {
      this.emailService
        .sendTaskAssignmentNotification(task.assignee!.email, task.title)
        .catch((error) => {
          console.error("Failed to send task assignment notification:", error);
        });
    }

    return task;
  }

  async remove(id: string) {
    const existingTask = await this.findOne(id);

    await this.taskQuery.deleteTask(id);
    await this.taskCache.invalidateTaskCaches(id);

    return { message: "Task deleted successfully" };
  }
}
