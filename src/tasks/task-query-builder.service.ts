import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TaskFilterDto } from "./dto/task-filter.dto";

@Injectable()
export class TaskQueryBuilder {
  constructor(private prisma: PrismaService) {}

  buildWhereClause(filterDto: TaskFilterDto): any {
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

    return where;
  }

  getTaskIncludeOptions() {
    return {
      assignee: true,
      project: true,
      tags: true,
    };
  }

  async executeTaskListQuery(filterDto: TaskFilterDto) {
    const where = this.buildWhereClause(filterDto);
    return await this.prisma.task.findMany({
      where,
      include: this.getTaskIncludeOptions(),
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async executeTaskQuery(id: string) {
    return await this.prisma.task.findUnique({
      where: { id },
      include: this.getTaskIncludeOptions(),
    });
  }

  async createTask(data: any) {
    return await this.prisma.task.create({
      data,
      include: this.getTaskIncludeOptions(),
    });
  }

  async updateTask(id: string, data: any) {
    return await this.prisma.task.update({
      where: { id },
      data,
      include: this.getTaskIncludeOptions(),
    });
  }

  async deleteTask(id: string) {
    return await this.prisma.task.delete({
      where: { id },
    });
  }
}
