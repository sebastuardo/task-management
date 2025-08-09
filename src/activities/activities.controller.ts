import { Controller, Get, Query, Param } from "@nestjs/common";
import { ActivitiesService } from "./activities.service";
import { ActivityFilterDto, PaginatedActivityResponseDto } from "./dto";

@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * GET /activities - Obtener todas las actividades con filtros y paginación
   */
  @Get()
  async findAll(
    @Query() filterDto: ActivityFilterDto
  ): Promise<PaginatedActivityResponseDto> {
    return this.activitiesService.findAll(filterDto);
  }
}

@Controller("tasks")
export class TaskActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * GET /tasks/:id/activities - Obtener actividades de una tarea específica
   */
  @Get(":id/activities")
  async getTaskActivities(
    @Param("id") taskId: string,
    @Query() filterDto: Partial<ActivityFilterDto>
  ): Promise<PaginatedActivityResponseDto> {
    return this.activitiesService.findByTaskId(taskId, filterDto);
  }
}
