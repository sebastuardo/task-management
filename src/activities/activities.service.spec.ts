import { Test, TestingModule } from "@nestjs/testing";
import { ActivitiesService } from "./activities.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityAction } from "@prisma/client";
import { ActivityFilterDto } from "./dto/activity-filter.dto";

describe("ActivitiesService", () => {
  let service: ActivitiesService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      taskActivity: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("logTaskCreated", () => {
    it("should log task creation activity", async () => {
      const taskId = "task-123";
      const userId = "user-123";

      mockPrismaService.taskActivity.create.mockResolvedValue({});

      await service.logTaskCreated(taskId, userId);

      expect(mockPrismaService.taskActivity.create).toHaveBeenCalledWith({
        data: {
          taskId,
          userId,
          action: ActivityAction.CREATED,
          changes: null,
        },
      });
    });

    it("should handle database errors during creation logging", async () => {
      const taskId = "task-123";
      const userId = "user-123";

      mockPrismaService.taskActivity.create.mockRejectedValue(
        new Error("Database error")
      );

      await expect(service.logTaskCreated(taskId, userId)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("logTaskUpdated", () => {
    it("should log task update activity with changes", async () => {
      const taskId = "task-123";
      const userId = "user-123";
      const changes = {
        title: { old: "Old Title", new: "New Title" },
        status: { old: "TODO", new: "IN_PROGRESS" },
      };

      mockPrismaService.taskActivity.create.mockResolvedValue({});

      await service.logTaskUpdated(taskId, userId, changes);

      expect(mockPrismaService.taskActivity.create).toHaveBeenCalledWith({
        data: {
          taskId,
          userId,
          action: ActivityAction.UPDATED,
          changes: JSON.stringify(changes),
        },
      });
    });

    it("should handle empty changes object", async () => {
      const taskId = "task-123";
      const userId = "user-123";
      const changes = {};

      mockPrismaService.taskActivity.create.mockResolvedValue({});

      await service.logTaskUpdated(taskId, userId, changes);

      // When changes object is empty, no activity should be logged
      expect(mockPrismaService.taskActivity.create).not.toHaveBeenCalled();
    });
  });

  describe("logTaskDeleted", () => {
    it("should log task deletion activity", async () => {
      const taskId = "task-123";
      const userId = "user-123";

      mockPrismaService.taskActivity.create.mockResolvedValue({});

      await service.logTaskDeleted(taskId, userId);

      expect(mockPrismaService.taskActivity.create).toHaveBeenCalledWith({
        data: {
          taskId,
          userId,
          action: ActivityAction.DELETED,
          changes: null,
        },
      });
    });
  });

  describe("findAll", () => {
    it("should return paginated activities", async () => {
      const filterDto: ActivityFilterDto = {
        userId: "user-123",
        action: ActivityAction.UPDATED,
        page: 1,
        perPage: 20,
      };

      const mockActivities = [
        {
          id: "activity-1",
          taskId: "task-123",
          userId: "user-123",
          action: ActivityAction.UPDATED,
          changes: JSON.stringify({ title: { old: "Old", new: "New" } }),
          createdAt: new Date(),
          task: { id: "task-123", title: "Test Task" },
          user: { id: "user-123", name: "John Doe" },
        },
      ];

      mockPrismaService.taskActivity.findMany.mockResolvedValue(mockActivities);
      mockPrismaService.taskActivity.count.mockResolvedValue(1);

      const result = await service.findAll(filterDto);

      expect(mockPrismaService.taskActivity.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          action: ActivityAction.UPDATED,
        },
        include: {
          task: { select: { id: true, title: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it("should handle date range filters", async () => {
      const filterDto: ActivityFilterDto = {
        dateFrom: "2025-01-01T00:00:00.000Z",
        dateTo: "2025-12-31T23:59:59.999Z",
        page: 1,
        perPage: 20,
      };

      mockPrismaService.taskActivity.findMany.mockResolvedValue([]);
      mockPrismaService.taskActivity.count.mockResolvedValue(0);

      await service.findAll(filterDto);

      expect(mockPrismaService.taskActivity.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date("2025-01-01T00:00:00.000Z"),
            lte: new Date("2025-12-31T23:59:59.999Z"),
          },
        },
        include: {
          task: { select: { id: true, title: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });

    it("should handle activities for deleted tasks", async () => {
      const filterDto: ActivityFilterDto = {
        taskId: "deleted-task-123",
        page: 1,
        perPage: 10,
      };

      const mockActivities = [
        {
          id: "activity-1",
          taskId: null, // Task was deleted
          userId: "user-123",
          action: ActivityAction.DELETED,
          changes: null,
          createdAt: new Date(),
          task: null,
          user: { id: "user-123", name: "John Doe" },
        },
      ];

      mockPrismaService.taskActivity.findMany.mockResolvedValue(mockActivities);
      mockPrismaService.taskActivity.count.mockResolvedValue(1);

      const result = await service.findAll(filterDto);

      expect(result.data[0].taskTitle).toBe("[Deleted Task]");
      expect(result.data[0].taskId).toBeNull();
    });

    it("should apply pagination correctly", async () => {
      const filterDto: ActivityFilterDto = {
        page: 3,
        perPage: 5,
      };

      mockPrismaService.taskActivity.findMany.mockResolvedValue([]);
      mockPrismaService.taskActivity.count.mockResolvedValue(0);

      await service.findAll(filterDto);

      expect(mockPrismaService.taskActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page - 1) * perPage = (3 - 1) * 5 = 10
          take: 5,
        })
      );
    });
  });

  describe("findByTaskId", () => {
    it("should return paginated task activities", async () => {
      const taskId = "task-123";
      const filterDto = { page: 1, perPage: 10 };

      const mockActivities = [
        {
          id: "activity-1",
          taskId,
          userId: "user-123",
          action: ActivityAction.CREATED,
          changes: null,
          createdAt: new Date(),
          task: { id: taskId, title: "Test Task" },
          user: { id: "user-123", name: "John Doe" },
        },
      ];

      const totalCount = 1;

      mockPrismaService.taskActivity.findMany.mockResolvedValue(mockActivities);
      mockPrismaService.taskActivity.count.mockResolvedValue(totalCount);

      const result = await service.findByTaskId(taskId, filterDto);

      expect(mockPrismaService.taskActivity.findMany).toHaveBeenCalledWith({
        where: { taskId },
        include: {
          task: { select: { id: true, title: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(mockPrismaService.taskActivity.count).toHaveBeenCalledWith({
        where: { taskId },
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
