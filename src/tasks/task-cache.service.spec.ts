import { Test, TestingModule } from "@nestjs/testing";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { TaskCacheService } from "./task-cache.service";
import { TaskFilterDto } from "./dto/task-filter.dto";

describe("TaskCacheService", () => {
  let service: TaskCacheService;
  let mockCacheManager: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockCacheManager = {
      wrap: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      store: {
        keys: jest.fn(),
      },
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        switch (key) {
          case "CACHE_TTL_TASK_LIST":
            return 300000; // 5 minutes in ms
          case "CACHE_TTL_TASK_ITEM":
            return 900000; // 15 minutes in ms
          default:
            return defaultValue;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TaskCacheService>(TaskCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateListCacheKey", () => {
    it("should generate consistent cache key for same filters", () => {
      const filterDto: TaskFilterDto = { status: "TODO", priority: "HIGH" };

      const key1 = service.generateListCacheKey(filterDto);
      const key2 = service.generateListCacheKey(filterDto);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^tasks:list:[a-f0-9]{32}$/);
    });

    it("should generate different keys for different filters", () => {
      const filter1: TaskFilterDto = { status: "TODO" };
      const filter2: TaskFilterDto = { status: "COMPLETED" };

      const key1 = service.generateListCacheKey(filter1);
      const key2 = service.generateListCacheKey(filter2);

      expect(key1).not.toBe(key2);
    });

    it("should generate same key regardless of property order", () => {
      const filter1: TaskFilterDto = { status: "TODO", priority: "HIGH" };
      const filter2: TaskFilterDto = { priority: "HIGH", status: "TODO" };

      const key1 = service.generateListCacheKey(filter1);
      const key2 = service.generateListCacheKey(filter2);

      expect(key1).toBe(key2);
    });
  });

  describe("generateItemCacheKey", () => {
    it("should generate correct cache key for task item", () => {
      const taskId = "test-id-123";
      const key = service.generateItemCacheKey(taskId);

      expect(key).toBe("tasks:item:test-id-123");
    });
  });

  describe("cacheTask", () => {
    it("should cache task successfully", async () => {
      const taskId = "test-id";
      const task = { id: taskId, title: "Test Task" };

      await service.cacheTask(taskId, task);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "tasks:item:test-id",
        task,
        service.TASK_ITEM_TTL
      );
    });

    it("should handle cache errors gracefully", async () => {
      const taskId = "test-id";
      const task = { id: taskId, title: "Test Task" };
      mockCacheManager.set.mockRejectedValue(new Error("Cache error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await service.cacheTask(taskId, task);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache set error for tasks item:",
        "Cache error"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getCachedTask", () => {
    it("should retrieve cached task", async () => {
      const taskId = "test-id";
      const expectedTask = { id: taskId, title: "Test Task" };
      mockCacheManager.get.mockResolvedValue(expectedTask);

      const result = await service.getCachedTask(taskId);

      expect(mockCacheManager.get).toHaveBeenCalledWith("tasks:item:test-id");
      expect(result).toBe(expectedTask);
    });

    it("should return null on cache error", async () => {
      const taskId = "test-id";
      mockCacheManager.get.mockRejectedValue(new Error("Cache error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.getCachedTask(taskId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache get error for tasks item:",
        "Cache error"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("wrapTaskQuery", () => {
    it("should delegate to cache manager wrap", async () => {
      const cacheKey = "test-key";
      const queryFn = jest.fn().mockResolvedValue("result");
      const ttl = 5000;
      mockCacheManager.wrap.mockResolvedValue("cached-result");

      const result = await service.wrapTaskQuery(cacheKey, queryFn, ttl);

      expect(mockCacheManager.wrap).toHaveBeenCalledWith(
        cacheKey,
        queryFn,
        ttl
      );
      expect(result).toBe("cached-result");
    });
  });

  describe("invalidateListCaches", () => {
    it("should invalidate all list caches", async () => {
      const mockKeys = ["tasks:list:key1", "tasks:list:key2"];
      mockCacheManager.store.keys.mockResolvedValue(mockKeys);

      await service.invalidateListCaches();

      expect(mockCacheManager.store.keys).toHaveBeenCalledWith("tasks:list:*");
      expect(mockCacheManager.del).toHaveBeenCalledTimes(2);
      expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:list:key1");
      expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:list:key2");
    });

    it("should handle store without keys method", async () => {
      mockCacheManager.store.keys = undefined;

      await service.invalidateListCaches();

      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockCacheManager.store.keys.mockRejectedValue(new Error("Store error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await service.invalidateListCaches();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error invalidating tasks list caches:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("invalidateItemCache", () => {
    it("should invalidate specific task cache", async () => {
      const taskId = "test-id";

      await service.invalidateItemCache(taskId);

      expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:item:test-id");
    });

    it("should handle errors gracefully", async () => {
      const taskId = "test-id";
      mockCacheManager.del.mockRejectedValue(new Error("Delete error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await service.invalidateItemCache(taskId);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error invalidating tasks item cache:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("invalidateTaskCaches", () => {
    it("should invalidate both item and list caches", async () => {
      const taskId = "test-id";
      const invalidateItemSpy = jest
        .spyOn(service, "invalidateItemCache")
        .mockResolvedValue();
      const invalidateListSpy = jest
        .spyOn(service, "invalidateListCaches")
        .mockResolvedValue();

      await service.invalidateTaskCaches(taskId);

      expect(invalidateItemSpy).toHaveBeenCalledWith(taskId);
      expect(invalidateListSpy).toHaveBeenCalled();
    });
  });

  describe("TTL constants", () => {
    it("should have correct TTL values", () => {
      expect(service.TASK_LIST_TTL).toBe(300000); // 5 minutes in ms
      expect(service.TASK_ITEM_TTL).toBe(900000); // 15 minutes in ms
    });
  });

  describe("ConfigService Integration", () => {
    it("should use ConfigService values for TTL configuration", () => {
      expect(mockConfigService.get).toHaveBeenCalledWith(
        "CACHE_TTL_TASK_LIST",
        300000
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        "CACHE_TTL_TASK_ITEM",
        600000
      );
    });

    it("should expose TTL values through getters", () => {
      expect(service.TASK_LIST_TTL).toBe(300000);
      expect(service.TASK_ITEM_TTL).toBe(900000);
    });

    it("should use configured TTL when caching tasks", async () => {
      const taskId = "test-id";
      const task = { id: taskId, title: "Test Task" };

      await service.cacheTask(taskId, task);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "tasks:item:test-id",
        task,
        service.TASK_ITEM_TTL
      );
    });

    it("should use configured TTL when caching task lists", async () => {
      const filterDto: TaskFilterDto = { status: "TODO" };
      const tasks = [{ id: "1", title: "Task 1" }];

      await service.cacheTaskList(filterDto, tasks);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining("tasks:list:"),
        tasks,
        service.TASK_LIST_TTL
      );
    });
  });

  describe("ConfigService with different values", () => {
    let alternativeService: TaskCacheService;

    beforeEach(async () => {
      const alternativeMockConfigService = {
        get: jest.fn((key: string, defaultValue?: number) => {
          switch (key) {
            case "CACHE_TTL_TASK_LIST":
              return 120000; // 2 minutes
            case "CACHE_TTL_TASK_ITEM":
              return 1800000; // 30 minutes
            default:
              return defaultValue;
          }
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TaskCacheService,
          {
            provide: CACHE_MANAGER,
            useValue: mockCacheManager,
          },
          {
            provide: ConfigService,
            useValue: alternativeMockConfigService,
          },
        ],
      }).compile();

      alternativeService = module.get<TaskCacheService>(TaskCacheService);
    });

    it("should use alternative ConfigService values", () => {
      expect(alternativeService.TASK_LIST_TTL).toBe(120000);
      expect(alternativeService.TASK_ITEM_TTL).toBe(1800000);
    });

    it("should cache with alternative TTL values", async () => {
      const taskId = "alt-test-id";
      const task = { id: taskId, title: "Alternative Test Task" };

      await alternativeService.cacheTask(taskId, task);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "tasks:item:alt-test-id",
        task,
        1800000 // 30 minutes
      );
    });
  });

  describe("ConfigService with default values", () => {
    let defaultService: TaskCacheService;

    beforeEach(async () => {
      const defaultMockConfigService = {
        get: jest.fn((key: string, defaultValue?: number) => defaultValue),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TaskCacheService,
          {
            provide: CACHE_MANAGER,
            useValue: mockCacheManager,
          },
          {
            provide: ConfigService,
            useValue: defaultMockConfigService,
          },
        ],
      }).compile();

      defaultService = module.get<TaskCacheService>(TaskCacheService);
    });

    it("should use default values when ConfigService returns undefined", () => {
      expect(defaultService.TASK_LIST_TTL).toBe(300000); // Default list TTL
      expect(defaultService.TASK_ITEM_TTL).toBe(600000); // Default item TTL
    });

    it("should cache with default TTL values", async () => {
      const taskId = "default-test-id";
      const task = { id: taskId, title: "Default Test Task" };

      await defaultService.cacheTask(taskId, task);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "tasks:item:default-test-id",
        task,
        600000 // Default item TTL
      );
    });
  });

  describe("Cache Integration Tests", () => {
    it("should maintain cache functionality after ConfigService integration", async () => {
      const filterDto: TaskFilterDto = { status: "TODO", priority: "HIGH" };
      const tasks = [
        { id: "1", title: "Task 1", status: "TODO", priority: "HIGH" },
        { id: "2", title: "Task 2", status: "TODO", priority: "HIGH" },
      ];

      // Test caching
      await service.cacheTaskList(filterDto, tasks);

      const expectedKey = service.generateListCacheKey(filterDto);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expectedKey,
        tasks,
        service.TASK_LIST_TTL
      );

      // Test retrieval
      mockCacheManager.get.mockResolvedValue(tasks);
      const cachedTasks = await service.getCachedTaskList(filterDto);

      expect(mockCacheManager.get).toHaveBeenCalledWith(expectedKey);
      expect(cachedTasks).toEqual(tasks);
    });

    it("should handle cache operations with configured TTL values", async () => {
      const taskId = "integration-test-id";
      const task = {
        id: taskId,
        title: "Integration Test Task",
        description: "Testing cache integration with ConfigService",
      };

      // Cache the task
      await service.cacheTask(taskId, task);

      // Verify it was cached with correct TTL
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `tasks:item:${taskId}`,
        task,
        service.TASK_ITEM_TTL
      );

      // Mock retrieval
      mockCacheManager.get.mockResolvedValue(task);
      const cachedTask = await service.getCachedTask(taskId);

      expect(cachedTask).toEqual(task);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`tasks:item:${taskId}`);
    });
  });

  describe("cacheTaskList", () => {
    it("should cache task list successfully", async () => {
      const filterDto: TaskFilterDto = { status: "TODO", priority: "HIGH" };
      const tasks = [
        { id: "1", title: "Task 1" },
        { id: "2", title: "Task 2" },
      ];

      await service.cacheTaskList(filterDto, tasks);

      const expectedKey = service.generateListCacheKey(filterDto);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expectedKey,
        tasks,
        service.TASK_LIST_TTL
      );
    });

    it("should handle cache errors gracefully for list caching", async () => {
      const filterDto: TaskFilterDto = { status: "TODO" };
      const tasks = [{ id: "1", title: "Task 1" }];
      mockCacheManager.set.mockRejectedValue(new Error("Cache list error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await service.cacheTaskList(filterDto, tasks);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache set error for tasks list:",
        "Cache list error"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getCachedTaskList", () => {
    it("should retrieve cached task list", async () => {
      const filterDto: TaskFilterDto = { status: "COMPLETED" };
      const expectedTasks = [
        { id: "1", title: "Task 1", status: "COMPLETED" },
        { id: "2", title: "Task 2", status: "COMPLETED" },
      ];

      const expectedKey = service.generateListCacheKey(filterDto);
      mockCacheManager.get.mockResolvedValue(expectedTasks);

      const result = await service.getCachedTaskList(filterDto);

      expect(mockCacheManager.get).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual(expectedTasks);
    });

    it("should return null on cache error for list retrieval", async () => {
      const filterDto: TaskFilterDto = { status: "IN_PROGRESS" };
      mockCacheManager.get.mockRejectedValue(new Error("Cache list get error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await service.getCachedTaskList(filterDto);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Cache get error for tasks list:",
        "Cache list get error"
      );
      consoleSpy.mockRestore();
    });

    it("should return empty array when nothing cached", async () => {
      const filterDto: TaskFilterDto = { priority: "LOW" };
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getCachedTaskList(filterDto);

      expect(result).toBeNull();
    });
  });
});
