import { Test, TestingModule } from "@nestjs/testing";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { TaskCacheService } from "./task-cache.service";
import { TaskFilterDto } from "./dto/task-filter.dto";

describe("TaskCacheService", () => {
  let service: TaskCacheService;
  let mockCacheManager: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
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
        "Cache set error for task:",
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
        "Cache get error for task:",
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
        "Error invalidating list caches:",
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
        "Error invalidating item cache:",
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
      expect(service.TASK_LIST_TTL).toBe(300 * 1000); // 5 minutes
      expect(service.TASK_ITEM_TTL).toBe(600 * 1000); // 10 minutes
    });
  });
});
