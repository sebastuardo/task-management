import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async findAll(filterDto: TaskFilterDto) {
    // PERFORMANCE ISSUE: N+1 Query Problem
    // Fetching tasks without includes, then fetching related data separately
    const tasks = await this.prisma.task.findMany();
    
    // For each task, fetch related data separately (N+1 problem)
    const tasksWithRelations = await Promise.all(
      tasks.map(async (task) => {
        const assignee = task.assigneeId 
          ? await this.prisma.user.findUnique({ where: { id: task.assigneeId } })
          : null;
        
        const project = await this.prisma.project.findUnique({ 
          where: { id: task.projectId } 
        });
        
        const tags = await this.prisma.tag.findMany({
          where: {
            tasks: {
              some: { id: task.id }
            }
          }
        });

        return {
          ...task,
          assignee,
          project,
          tags,
        };
      })
    );

    // PERFORMANCE ISSUE: In-memory filtering instead of database queries
    let filteredTasks = tasksWithRelations;

    if (filterDto.status) {
      filteredTasks = filteredTasks.filter(task => task.status === filterDto.status);
    }

    if (filterDto.priority) {
      filteredTasks = filteredTasks.filter(task => task.priority === filterDto.priority);
    }

    if (filterDto.assigneeId) {
      filteredTasks = filteredTasks.filter(task => task.assigneeId === filterDto.assigneeId);
    }

    if (filterDto.projectId) {
      filteredTasks = filteredTasks.filter(task => task.projectId === filterDto.projectId);
    }

    if (filterDto.dueDateFrom || filterDto.dueDateTo) {
      filteredTasks = filteredTasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        
        if (filterDto.dueDateFrom && dueDate < new Date(filterDto.dueDateFrom)) {
          return false;
        }
        
        if (filterDto.dueDateTo && dueDate > new Date(filterDto.dueDateTo)) {
          return false;
        }
        
        return true;
      });
    }

    return filteredTasks;
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
          ? { connect: createTaskDto.tagIds.map(id => ({ id })) }
          : undefined,
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // PERFORMANCE ISSUE: Synchronous email notification blocking response
    if (task.assignee) {
      await this.emailService.sendTaskAssignmentNotification(
        task.assignee.email,
        task.title
      );
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
        assignee: updateTaskDto.assigneeId !== undefined
          ? updateTaskDto.assigneeId 
            ? { connect: { id: updateTaskDto.assigneeId } }
            : { disconnect: true }
          : undefined,
        tags: updateTaskDto.tagIds
          ? { set: updateTaskDto.tagIds.map(id => ({ id })) }
          : undefined,
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // PERFORMANCE ISSUE: Synchronous email notification blocking response
    if (updateTaskDto.assigneeId && updateTaskDto.assigneeId !== existingTask.assigneeId) {
      await this.emailService.sendTaskAssignmentNotification(
        task.assignee!.email,
        task.title
      );
    }

    return task;
  }

  async remove(id: string) {
    await this.findOne(id);
    
    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }
}
