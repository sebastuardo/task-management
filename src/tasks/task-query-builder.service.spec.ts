import { Test, TestingModule } from "@nestjs/testing";
import { TaskQueryBuilder } from "./task-query-builder.service";
import { PrismaService } from "../prisma/prisma.service";
import { TaskFilterDto } from "./dto/task-filter.dto";

describe("TaskQueryBuilder", () => {
  let service: TaskQueryBuilder;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskQueryBuilder,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TaskQueryBuilder>(TaskQueryBuilder);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("buildWhereClause", () => {
    it("should build where clause with status filter", () => {
      const filterDto: TaskFilterDto = { status: "TODO" };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({ status: "TODO" });
    });

    it("should build where clause with priority filter", () => {
      const filterDto: TaskFilterDto = { priority: "HIGH" };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({ priority: "HIGH" });
    });

    it("should build where clause with assigneeId filter", () => {
      const filterDto: TaskFilterDto = { assigneeId: "user-123" };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({ assigneeId: "user-123" });
    });

    it("should build where clause with projectId filter", () => {
      const filterDto: TaskFilterDto = { projectId: "project-123" };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({ projectId: "project-123" });
    });

    it("should build where clause with date range filters", () => {
      const filterDto: TaskFilterDto = {
        dueDateFrom: "2024-01-01",
        dueDateTo: "2024-12-31",
      };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({
        dueDate: {
          gte: new Date("2024-01-01"),
          lte: new Date("2024-12-31"),
        },
      });
    });

    it("should build where clause with only dueDateFrom", () => {
      const filterDto: TaskFilterDto = { dueDateFrom: "2024-01-01" };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({
        dueDate: {
          gte: new Date("2024-01-01"),
        },
      });
    });

    it("should build where clause with only dueDateTo", () => {
      const filterDto: TaskFilterDto = { dueDateTo: "2024-12-31" };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({
        dueDate: {
          lte: new Date("2024-12-31"),
        },
      });
    });

    it("should build where clause with multiple filters", () => {
      const filterDto: TaskFilterDto = {
        status: "TODO",
        priority: "HIGH",
        assigneeId: "user-123",
        projectId: "project-123",
      };

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({
        status: "TODO",
        priority: "HIGH",
        assigneeId: "user-123",
        projectId: "project-123",
      });
    });

    it("should return empty object for empty filter", () => {
      const filterDto: TaskFilterDto = {};

      const where = service.buildWhereClause(filterDto);

      expect(where).toEqual({});
    });
  });

  describe("getTaskIncludeOptions", () => {
    it("should return correct include options", () => {
      const includeOptions = service.getTaskIncludeOptions();

      expect(includeOptions).toEqual({
        assignee: true,
        project: true,
        tags: true,
      });
    });
  });

  describe("executeTaskListQuery", () => {
    it("should execute task list query with correct parameters", async () => {
      const filterDto: TaskFilterDto = { status: "TODO" };
      const expectedTasks = [{ id: "1", title: "Task 1" }];
      mockPrismaService.task.findMany.mockResolvedValue(expectedTasks);

      const result = await service.executeTaskListQuery(filterDto);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { status: "TODO" },
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      expect(result).toBe(expectedTasks);
    });
  });

  describe("executeTaskQuery", () => {
    it("should execute single task query", async () => {
      const taskId = "task-123";
      const expectedTask = { id: taskId, title: "Task 1" };
      mockPrismaService.task.findUnique.mockResolvedValue(expectedTask);

      const result = await service.executeTaskQuery(taskId);

      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
      });
      expect(result).toBe(expectedTask);
    });
  });

  describe("createTask", () => {
    it("should create task with correct data", async () => {
      const taskData = {
        title: "New Task",
        description: "Task description",
        status: "TODO",
      };
      const expectedTask = { id: "new-task-id", ...taskData };
      mockPrismaService.task.create.mockResolvedValue(expectedTask);

      const result = await service.createTask(taskData);

      expect(mockPrismaService.task.create).toHaveBeenCalledWith({
        data: taskData,
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
      });
      expect(result).toBe(expectedTask);
    });
  });

  describe("updateTask", () => {
    it("should update task with correct data", async () => {
      const taskId = "task-123";
      const updateData = {
        title: "Updated Task",
        status: "IN_PROGRESS",
      };
      const expectedTask = { id: taskId, ...updateData };
      mockPrismaService.task.update.mockResolvedValue(expectedTask);

      const result = await service.updateTask(taskId, updateData);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: updateData,
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
      });
      expect(result).toBe(expectedTask);
    });
  });

  describe("deleteTask", () => {
    it("should delete task", async () => {
      const taskId = "task-123";
      const expectedResult = { id: taskId };
      mockPrismaService.task.delete.mockResolvedValue(expectedResult);

      const result = await service.deleteTask(taskId);

      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { id: taskId },
      });
      expect(result).toBe(expectedResult);
    });
  });
});
