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
      cacheTask: jest.fn(),
      invalidateListCaches: jest.fn(),
      invalidateTaskCaches: jest.fn(),
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

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.findAll(filterDto);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache error in findAll, using fallback:",
        "Cache error"
      );
      expect(mockTaskQuery.executeTaskListQuery).toHaveBeenCalledWith(
        filterDto
      );
      expect(result).toBe(expectedTasks);

      consoleSpy.mockRestore();
    });
  });

  describe("findOne", () => {
    it("should return cached task when cache works", async () => {
      const taskId = "task-123";
      const cacheKey = "test-cache-key";
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

    it("should throw NotFoundException when task not found in cache", async () => {
      const taskId = "non-existent-task";
      const cacheKey = "test-cache-key";

      mockTaskCache.generateItemCacheKey.mockReturnValue(cacheKey);
      mockTaskCache.wrapTaskQuery.mockImplementation(async (key, queryFn) => {
        return await queryFn();
      });
      mockTaskQuery.executeTaskQuery.mockResolvedValue(null);

      await expect(service.findOne(taskId)).rejects.toThrow(NotFoundException);
    });

    it("should fallback to direct query when cache fails", async () => {
      const taskId = "task-123";
      const expectedTask = { id: taskId, title: "Task 1" };

      mockTaskCache.generateItemCacheKey.mockReturnValue("cache-key");
      mockTaskCache.wrapTaskQuery.mockRejectedValue(new Error("Cache error"));
      mockTaskQuery.executeTaskQuery.mockResolvedValue(expectedTask);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.findOne(taskId);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache error in findOne, using fallback:",
        "Cache error"
      );
      expect(mockTaskQuery.executeTaskQuery).toHaveBeenCalledWith(taskId);
      expect(result).toBe(expectedTask);

      consoleSpy.mockRestore();
    });

    it("should throw NotFoundException when task not found in fallback query", async () => {
      const taskId = "non-existent-task";

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
      expect(result).toBe(createdTask);
    });

    it("should create task without assignee", async () => {
      const createTaskDto: CreateTaskDto = {
        title: "New Task",
        description: "Task description",
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

      expect(mockTaskQuery.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          assignee: undefined,
        })
      );

      expect(
        mockEmailService.sendTaskAssignmentNotification
      ).not.toHaveBeenCalled();
      expect(result).toBe(createdTask);
    });

    it("should handle email sending errors gracefully", async () => {
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
      mockEmailService.sendTaskAssignmentNotification.mockRejectedValue(
        new Error("Email error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.create(createTaskDto);

      expect(result).toBe(createdTask);

      // Wait a bit for the async email to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to send task assignment notification:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("update", () => {
    it("should update task and invalidate cache", async () => {
      const taskId = "task-123";
      const updateTaskDto: UpdateTaskDto = {
        title: "Updated Task",
        status: "IN_PROGRESS",
      };

      const existingTask = { id: taskId, title: "Old Task", assigneeId: null };
      const updatedTask = { id: taskId, ...updateTaskDto };

      jest.spyOn(service, "findOne").mockResolvedValue(existingTask as any);
      mockTaskQuery.updateTask.mockResolvedValue(updatedTask);

      const result = await service.update(taskId, updateTaskDto);

      expect(service.findOne).toHaveBeenCalledWith(taskId);
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

    it("should send email when assignee changes", async () => {
      const taskId = "task-123";
      const updateTaskDto: UpdateTaskDto = {
        assigneeId: "new-user-123",
      };

      const existingTask = { id: taskId, assigneeId: "old-user-123" };
      const updatedTask = {
        id: taskId,
        title: "Task Title",
        assignee: { id: "new-user-123", email: "newuser@example.com" },
      };

      jest.spyOn(service, "findOne").mockResolvedValue(existingTask as any);
      mockTaskQuery.updateTask.mockResolvedValue(updatedTask);
      mockEmailService.sendTaskAssignmentNotification.mockResolvedValue(
        undefined
      );

      await service.update(taskId, updateTaskDto);

      expect(
        mockEmailService.sendTaskAssignmentNotification
      ).toHaveBeenCalledWith("newuser@example.com", updatedTask.title);
    });
  });

  describe("remove", () => {
    it("should delete task and invalidate cache", async () => {
      const taskId = "task-123";
      const existingTask = { id: taskId, title: "Task to delete" };

      jest.spyOn(service, "findOne").mockResolvedValue(existingTask as any);
      mockTaskQuery.deleteTask.mockResolvedValue(undefined);

      const result = await service.remove(taskId);

      expect(service.findOne).toHaveBeenCalledWith(taskId);
      expect(mockTaskQuery.deleteTask).toHaveBeenCalledWith(taskId);
      expect(mockTaskCache.invalidateTaskCaches).toHaveBeenCalledWith(taskId);
      expect(result).toEqual({ message: "Task deleted successfully" });
    });

    it("should throw NotFoundException when task does not exist", async () => {
      const taskId = "non-existent-task";

      jest.spyOn(service, "findOne").mockRejectedValue(new NotFoundException());

      await expect(service.remove(taskId)).rejects.toThrow(NotFoundException);
      expect(mockTaskQuery.deleteTask).not.toHaveBeenCalled();
    });
  });
});
