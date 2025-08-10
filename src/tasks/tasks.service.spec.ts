import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { TaskCacheService } from "./task-cache.service";
import { TaskQueryBuilder } from "./task-query-builder.service";
import { EmailService } from "../email/email.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskFilterDto } from "./dto/task-filter.dto";

describe("TasksService", () => {
  let service: TasksService;
  let mockTaskCache: any;
  let mockTaskQuery: any;
  let mockEmailService: any;

  beforeEach(async () => {
    mockTaskCache = {
      generateListCacheKey: jest.fn(),
      generateItemCacheKey: jest.fn(),
      wrapTaskQuery: jest.fn(),
      cacheTask: jest.fn().mockResolvedValue(undefined),
      invalidateListCaches: jest.fn().mockResolvedValue(undefined),
      invalidateTaskCaches: jest.fn().mockResolvedValue(undefined),
      TASK_LIST_TTL: 300000,
      TASK_ITEM_TTL: 600000,
    };

    mockTaskQuery = {
      executeTaskListQuery: jest.fn(),
      executeTaskQuery: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
    };

    mockEmailService = {
      sendTaskAssignmentNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: TaskCacheService,
          useValue: mockTaskCache,
        },
        {
          provide: TaskQueryBuilder,
          useValue: mockTaskQuery,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return cached tasks when cache works", async () => {
      const filterDto: TaskFilterDto = { status: "TODO" };
      const cacheKey = "test-cache-key";
      const expectedTasks = [{ id: "1", title: "Task 1" }];

      mockTaskCache.generateListCacheKey.mockReturnValue(cacheKey);
      mockTaskCache.wrapTaskQuery.mockResolvedValue(expectedTasks);

      const result = await service.findAll(filterDto);

      expect(mockTaskCache.generateListCacheKey).toHaveBeenCalledWith(
        filterDto
      );
      expect(mockTaskCache.wrapTaskQuery).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Function),
        mockTaskCache.TASK_LIST_TTL
      );
      expect(result).toBe(expectedTasks);
    });

    it("should fallback to direct query when cache fails", async () => {
      const filterDto: TaskFilterDto = { status: "TODO" };
      const expectedTasks = [{ id: "1", title: "Task 1" }];

      mockTaskCache.generateListCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockRejectedValue(new Error("Cache error"));
      mockTaskQuery.executeTaskListQuery.mockResolvedValue(expectedTasks);

      jest.spyOn(console, "error").mockImplementation();

      const result = await service.findAll(filterDto);

      expect(mockTaskQuery.executeTaskListQuery).toHaveBeenCalledWith(
        filterDto
      );
      expect(result).toBe(expectedTasks);
    });
  });

  describe("findOne", () => {
    it("should return cached task when available", async () => {
      const taskId = "task-123";
      const cacheKey = "cache-key";
      const expectedTask = { id: taskId, title: "Task 1" };

      mockTaskCache.generateItemCacheKey.mockReturnValue(cacheKey);
      mockTaskCache.wrapTaskQuery.mockResolvedValue(expectedTask);

      const result = await service.findOne(taskId);

      expect(mockTaskCache.generateItemCacheKey).toHaveBeenCalledWith(taskId);
      expect(mockTaskCache.wrapTaskQuery).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Function),
        mockTaskCache.TASK_ITEM_TTL
      );
      expect(result).toBe(expectedTask);
    });

    it("should fallback to direct query when cache fails", async () => {
      const taskId = "task-123";
      const expectedTask = { id: taskId, title: "Task 1" };

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockRejectedValue(new Error("Cache error"));
      mockTaskQuery.executeTaskQuery.mockResolvedValue(expectedTask);

      jest.spyOn(console, "error").mockImplementation();

      const result = await service.findOne(taskId);

      expect(mockTaskQuery.executeTaskQuery).toHaveBeenCalledWith(taskId);
      expect(result).toBe(expectedTask);
    });

    it("should throw NotFoundException when task not found in fallback", async () => {
      const taskId = "non-existent";

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockRejectedValue(new Error("Cache error"));
      mockTaskQuery.executeTaskQuery.mockResolvedValue(null);

      jest.spyOn(console, "error").mockImplementation();

      await expect(service.findOne(taskId)).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create task and handle caching", async () => {
      const createTaskDto: CreateTaskDto = {
        title: "New Task",
        description: "Task description",
        status: "TODO",
        priority: "HIGH",
        projectId: "project-123",
        assigneeId: "user-123",
      };

      const createdTask = {
        id: "new-task-id",
        ...createTaskDto,
        assignee: { id: "user-123", email: "user@example.com" },
      };

      mockTaskQuery.createTask.mockResolvedValue(createdTask);
      mockEmailService.sendTaskAssignmentNotification.mockResolvedValue(
        undefined
      );

      const result = await service.create(createTaskDto);

      expect(mockTaskQuery.createTask).toHaveBeenCalledWith({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        priority: createTaskDto.priority,
        dueDate: createTaskDto.dueDate,
        project: { connect: { id: createTaskDto.projectId } },
        assignee: { connect: { id: createTaskDto.assigneeId } },
        tags: undefined,
      });

      expect(mockTaskCache.cacheTask).toHaveBeenCalledWith(
        createdTask.id,
        createdTask
      );
      expect(mockTaskCache.invalidateListCaches).toHaveBeenCalled();
      expect(
        mockEmailService.sendTaskAssignmentNotification
      ).toHaveBeenCalledWith("user@example.com", "New Task");
      expect(result).toBe(createdTask);
    });

    it("should create task without assignee", async () => {
      const createTaskDto: CreateTaskDto = {
        title: "New Task",
        status: "TODO",
        priority: "HIGH",
        projectId: "project-123",
      };

      const createdTask = {
        id: "new-task-id",
        ...createTaskDto,
        assignee: null,
      };

      mockTaskQuery.createTask.mockResolvedValue(createdTask);

      const result = await service.create(createTaskDto);

      expect(mockTaskQuery.createTask).toHaveBeenCalledWith({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        priority: createTaskDto.priority,
        dueDate: createTaskDto.dueDate,
        project: { connect: { id: createTaskDto.projectId } },
        assignee: undefined,
        tags: undefined,
      });

      expect(
        mockEmailService.sendTaskAssignmentNotification
      ).not.toHaveBeenCalled();
      expect(result).toBe(createdTask);
    });

    it("should handle email notification errors gracefully", async () => {
      const createTaskDto: CreateTaskDto = {
        title: "New Task",
        status: "TODO",
        priority: "HIGH",
        projectId: "project-123",
        assigneeId: "user-123",
      };

      const createdTask = {
        id: "new-task-id",
        ...createTaskDto,
        assignee: { id: "user-123", email: "user@example.com" },
      };

      mockTaskQuery.createTask.mockResolvedValue(createdTask);
      mockEmailService.sendTaskAssignmentNotification.mockRejectedValue(
        new Error("Email failed")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.create(createTaskDto);

      expect(result).toBe(createdTask);

      consoleSpy.mockRestore();
    });
  });

  describe("update", () => {
    it("should update task and handle caching", async () => {
      const taskId = "task-123";
      const updateTaskDto: UpdateTaskDto = {
        title: "Updated Task",
        status: "IN_PROGRESS",
      };

      const existingTask = {
        id: taskId,
        title: "Original Task",
        status: "TODO",
        assigneeId: null,
      };

      const updatedTask = {
        ...existingTask,
        ...updateTaskDto,
      };

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockResolvedValue(existingTask);
      mockTaskQuery.updateTask.mockResolvedValue(updatedTask);

      const result = await service.update(taskId, updateTaskDto);

      expect(mockTaskQuery.updateTask).toHaveBeenCalledWith(taskId, {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        status: updateTaskDto.status,
        priority: updateTaskDto.priority,
        dueDate: updateTaskDto.dueDate,
        assignee: undefined,
        tags: undefined,
      });

      expect(mockTaskCache.invalidateTaskCaches).toHaveBeenCalledWith(taskId);
      expect(result).toBe(updatedTask);
    });

    it("should send notification when assignee changes", async () => {
      const taskId = "task-123";
      const updateTaskDto: UpdateTaskDto = {
        assigneeId: "new-user-123",
      };

      const existingTask = {
        id: taskId,
        title: "Task",
        assigneeId: "old-user-123",
      };

      const updatedTask = {
        ...existingTask,
        assigneeId: "new-user-123",
        assignee: { id: "new-user-123", email: "newuser@example.com" },
        title: "Task",
      };

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockResolvedValue(existingTask);
      mockTaskQuery.updateTask.mockResolvedValue(updatedTask);
      mockEmailService.sendTaskAssignmentNotification.mockResolvedValue(
        undefined
      );

      await service.update(taskId, updateTaskDto);

      expect(
        mockEmailService.sendTaskAssignmentNotification
      ).toHaveBeenCalledWith("newuser@example.com", "Task");
    });

    it("should handle email notification errors during update", async () => {
      const taskId = "task-123";
      const updateTaskDto: UpdateTaskDto = {
        assigneeId: "new-user-123",
      };

      const existingTask = {
        id: taskId,
        title: "Task",
        assigneeId: "old-user-123",
      };

      const updatedTask = {
        ...existingTask,
        assigneeId: "new-user-123",
        assignee: { id: "new-user-123", email: "newuser@example.com" },
        title: "Task",
      };

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockResolvedValue(existingTask);
      mockTaskQuery.updateTask.mockResolvedValue(updatedTask);
      mockEmailService.sendTaskAssignmentNotification.mockRejectedValue(
        new Error("Email failed")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.update(taskId, updateTaskDto);

      expect(result).toBe(updatedTask);

      consoleSpy.mockRestore();
    });
  });

  describe("remove", () => {
    it("should remove task and invalidate cache", async () => {
      const taskId = "task-123";
      const existingTask = {
        id: taskId,
        title: "Task to delete",
      };

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockResolvedValue(existingTask);
      mockTaskQuery.deleteTask.mockResolvedValue(undefined);

      const result = await service.remove(taskId);

      expect(mockTaskQuery.deleteTask).toHaveBeenCalledWith(taskId);
      expect(mockTaskCache.invalidateTaskCaches).toHaveBeenCalledWith(taskId);
      expect(result).toEqual({ message: "Task deleted successfully" });
    });
  });
});
