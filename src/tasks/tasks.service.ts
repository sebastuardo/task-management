import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskFilterDto } from "./dto/task-filter.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  async findAll(filterDto: TaskFilterDto) {
    // Build the where clause based on filters
    const where: any = {};

    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.priority) {
      where.priority = filterDto.priority;
    }

    if (filterDto.assigneeId) {
      where.assigneeId = filterDto.assigneeId;
    }

    if (filterDto.projectId) {
      where.projectId = filterDto.projectId;
    }

    if (filterDto.dueDateFrom || filterDto.dueDateTo) {
      where.dueDate = {};

      if (filterDto.dueDateFrom) {
        where.dueDate.gte = new Date(filterDto.dueDateFrom);
      }

      if (filterDto.dueDateTo) {
        where.dueDate.lte = new Date(filterDto.dueDateTo);
      }
    }

    // Single optimized query with all relations included
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return tasks;
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async create(createTaskDto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
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
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // PERFORMANCE FIX: Send email asynchronously without blocking response
    if (task.assignee) {
      this.emailService
        .sendTaskAssignmentNotification(task.assignee.email, task.title)
        .catch((error) => {
          // Log error but don't fail the request
          console.error("Failed to send task assignment notification:", error);
        });
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const existingTask = await this.findOne(id);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
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
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // PERFORMANCE FIX: Send email asynchronously without blocking response
    if (
      updateTaskDto.assigneeId &&
      updateTaskDto.assigneeId !== existingTask.assigneeId
    ) {
      this.emailService
        .sendTaskAssignmentNotification(task.assignee!.email, task.title)
        .catch((error) => {
          // Log error but don't fail the request
          console.error("Failed to send task assignment notification:", error);
        });
    }

    return task;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.task.delete({
      where: { id },
    });

    return { message: "Task deleted successfully" };
  }
}
