import { Test, TestingModule } from "@nestjs/testing";
import {
  ActivitiesController,
  TaskActivitiesController,
} from "./activities.controller";
import { ActivitiesService } from "./activities.service";
import { ActivityFilterDto } from "./dto/activity-filter.dto";
import { ActivityAction } from "@prisma/client";

describe("ActivitiesController", () => {
  let controller: ActivitiesController;
  let mockActivitiesService: any;

  beforeEach(async () => {
    mockActivitiesService = {
      findAll: jest.fn(),
      findByTaskId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
      ],
    }).compile();

    controller = module.get<ActivitiesController>(ActivitiesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return paginated activities with default filters", async () => {
      const filterDto: ActivityFilterDto = {};
      const expectedResult = {
        data: [
          {
            id: "activity-1",
            taskId: "task-123",
            taskTitle: "Test Task",
            userId: "user-123",
            userName: "John Doe",
            action: ActivityAction.CREATED,
            changes: null,
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 1,
          page: 1,
          perPage: 20,
          totalPages: 1,
        },
      };

      mockActivitiesService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto);

      expect(mockActivitiesService.findAll).toHaveBeenCalledWith(filterDto);
      expect(result).toBe(expectedResult);
    });

    it("should return filtered activities by user", async () => {
      const filterDto: ActivityFilterDto = {
        userId: "user-123",
        page: 1,
        perPage: 10,
      };

      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          perPage: 10,
          totalPages: 0,
        },
      };

      mockActivitiesService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto);

      expect(mockActivitiesService.findAll).toHaveBeenCalledWith({
        userId: "user-123",
        page: 1,
        perPage: 10,
      });
      expect(result).toBe(expectedResult);
    });

    it("should return filtered activities by action type", async () => {
      const filterDto: ActivityFilterDto = {
        action: ActivityAction.DELETED,
        page: 1,
        perPage: 20,
      };

      const expectedResult = {
        data: [
          {
            id: "activity-1",
            taskId: null,
            taskTitle: "[Deleted Task]",
            userId: "user-123",
            userName: "John Doe",
            action: ActivityAction.DELETED,
            changes: null,
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 1,
          page: 1,
          perPage: 20,
          totalPages: 1,
        },
      };

      mockActivitiesService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto);

      expect(mockActivitiesService.findAll).toHaveBeenCalledWith({
        action: ActivityAction.DELETED,
        page: 1,
        perPage: 20,
      });
      expect(result).toBe(expectedResult);
    });

    it("should return filtered activities by date range", async () => {
      const filterDto: ActivityFilterDto = {
        dateFrom: "2025-01-01T00:00:00.000Z",
        dateTo: "2025-12-31T23:59:59.999Z",
        page: 1,
        perPage: 20,
      };

      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          perPage: 20,
          totalPages: 0,
        },
      };

      mockActivitiesService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto);

      expect(mockActivitiesService.findAll).toHaveBeenCalledWith({
        dateFrom: "2025-01-01T00:00:00.000Z",
        dateTo: "2025-12-31T23:59:59.999Z",
        page: 1,
        perPage: 20,
      });
      expect(result).toBe(expectedResult);
    });

    it("should handle complex filters", async () => {
      const filterDto: ActivityFilterDto = {
        userId: "user-123",
        action: ActivityAction.UPDATED,
        taskId: "task-456",
        dateFrom: "2025-08-01T00:00:00.000Z",
        dateTo: "2025-08-31T23:59:59.999Z",
        page: 2,
        perPage: 5,
      };

      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 2,
          perPage: 5,
          totalPages: 0,
        },
      };

      mockActivitiesService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(filterDto);

      expect(mockActivitiesService.findAll).toHaveBeenCalledWith(filterDto);
      expect(result).toBe(expectedResult);
    });
  });
});

describe("TaskActivitiesController", () => {
  let controller: TaskActivitiesController;
  let mockActivitiesService: any;

  beforeEach(async () => {
    mockActivitiesService = {
      findAll: jest.fn(),
      findByTaskId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
      ],
    }).compile();

    controller = module.get<TaskActivitiesController>(TaskActivitiesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getTaskActivities", () => {
    it("should return activities for specific task", async () => {
      const taskId = "task-123";
      const filterDto: Partial<ActivityFilterDto> = {
        page: 1,
        perPage: 10,
      };

      const expectedResult = {
        data: [
          {
            id: "activity-1",
            taskId: "task-123",
            taskTitle: "Test Task",
            userId: "user-123",
            userName: "John Doe",
            action: ActivityAction.CREATED,
            changes: null,
            createdAt: new Date(),
          },
          {
            id: "activity-2",
            taskId: "task-123",
            taskTitle: "Test Task",
            userId: "user-123",
            userName: "John Doe",
            action: ActivityAction.UPDATED,
            changes: {
              status: { old: "TODO", new: "IN_PROGRESS" },
            },
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 2,
          page: 1,
          perPage: 10,
          totalPages: 1,
        },
      };

      mockActivitiesService.findByTaskId.mockResolvedValue(expectedResult);

      const result = await controller.getTaskActivities(taskId, filterDto);

      expect(mockActivitiesService.findByTaskId).toHaveBeenCalledWith(
        taskId,
        filterDto
      );
      expect(result).toBe(expectedResult);
    });

    it("should handle empty filter dto for task activities", async () => {
      const taskId = "task-123";
      const filterDto = {};

      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          perPage: 20,
          totalPages: 0,
        },
      };

      mockActivitiesService.findByTaskId.mockResolvedValue(expectedResult);

      const result = await controller.getTaskActivities(taskId, filterDto);

      expect(mockActivitiesService.findByTaskId).toHaveBeenCalledWith(
        taskId,
        {}
      );
      expect(result).toBe(expectedResult);
    });

    it("should handle pagination for task activities", async () => {
      const taskId = "task-123";
      const filterDto: Partial<ActivityFilterDto> = {
        page: 3,
        perPage: 5,
      };

      const expectedResult = {
        data: [],
        meta: {
          total: 15,
          page: 3,
          perPage: 5,
          totalPages: 3,
        },
      };

      mockActivitiesService.findByTaskId.mockResolvedValue(expectedResult);

      const result = await controller.getTaskActivities(taskId, filterDto);

      expect(mockActivitiesService.findByTaskId).toHaveBeenCalledWith(taskId, {
        page: 3,
        perPage: 5,
      });
      expect(result).toBe(expectedResult);
    });
  });
});
