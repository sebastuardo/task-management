import { Injectable } from "@nestjs/common";
import { ActivityAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ActivityFilterDto,
  ActivityResponseDto,
  PaginatedActivityResponseDto,
  CreateActivityDto,
} from "./dto";

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva actividad en la base de datos
   */
  async createActivity(createActivityDto: CreateActivityDto): Promise<void> {
    await this.prisma.taskActivity.create({
      data: {
        taskId: createActivityDto.taskId,
        userId: createActivityDto.userId,
        action: createActivityDto.action,
        changes: createActivityDto.changes
          ? JSON.stringify(createActivityDto.changes)
          : null,
      },
    });
  }

  /**
   * Obtiene todas las actividades con filtros y paginación
   */
  async findAll(
    filterDto: ActivityFilterDto
  ): Promise<PaginatedActivityResponseDto> {
    const { page = 1, perPage = 20, ...filters } = filterDto;
    const skip = (page - 1) * perPage;

    // Construir filtros dinámicos
    const where = this.buildWhereClause(filters);

    // Ejecutar consultas en paralelo para optimizar performance
    const [activities, total] = await Promise.all([
      this.prisma.taskActivity.findMany({
        where,
        include: {
          task: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: perPage,
      }),
      this.prisma.taskActivity.count({ where }),
    ]);

    // Transformar resultados
    const data = activities.map((activity) =>
      this.transformToResponseDto(activity)
    );

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Obtiene actividades de una tarea específica
   */
  async findByTaskId(
    taskId: string,
    filterDto: Partial<ActivityFilterDto> = {}
  ): Promise<PaginatedActivityResponseDto> {
    const combinedFilter: ActivityFilterDto = {
      ...filterDto,
      taskId,
    };

    return this.findAll(combinedFilter);
  }

  /**
   * Obtiene actividades de un usuario específico
   */
  async findByUserId(
    userId: string,
    filterDto: Partial<ActivityFilterDto> = {}
  ): Promise<PaginatedActivityResponseDto> {
    const combinedFilter: ActivityFilterDto = {
      ...filterDto,
      userId,
    };

    return this.findAll(combinedFilter);
  }

  /**
   * Registra una actividad de creación de tarea
   */
  async logTaskCreated(taskId: string, userId: string): Promise<void> {
    const createDto = new CreateActivityDto(
      taskId,
      userId,
      ActivityAction.CREATED
    );

    await this.createActivity(createDto);
  }

  /**
   * Registra una actividad de actualización de tarea
   */
  async logTaskUpdated(
    taskId: string,
    userId: string,
    changes: any
  ): Promise<void> {
    if (!changes || Object.keys(changes).length === 0) {
      return; // No hay cambios que registrar
    }

    const createDto = new CreateActivityDto(
      taskId,
      userId,
      ActivityAction.UPDATED,
      changes
    );

    await this.createActivity(createDto);
  }

  /**
   * Registra una actividad de eliminación de tarea
   */
  async logTaskDeleted(taskId: string, userId: string): Promise<void> {
    const createDto = new CreateActivityDto(
      taskId,
      userId,
      ActivityAction.DELETED
    );

    await this.createActivity(createDto);
  }

  /**
   * Construye la cláusula WHERE dinámicamente basada en filtros
   */
  private buildWhereClause(filters: Partial<ActivityFilterDto>) {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.taskId) {
      where.taskId = filters.taskId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};

      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }

      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    return where;
  }

  /**
   * Transforma el resultado de Prisma al DTO de respuesta
   */
  private transformToResponseDto(activity: any): ActivityResponseDto {
    let parsedChanges = undefined;

    if (activity.changes) {
      try {
        parsedChanges =
          typeof activity.changes === "string"
            ? JSON.parse(activity.changes)
            : activity.changes;
      } catch (error) {
        console.error("Error parsing activity changes:", error);
        parsedChanges = activity.changes;
      }
    }

    return {
      id: activity.id,
      taskId: activity.taskId,
      taskTitle: activity.task?.title || "[Deleted Task]",
      userId: activity.userId,
      userName: activity.user.name,
      action: activity.action,
      changes: parsedChanges,
      createdAt: activity.createdAt,
    };
  }
}
