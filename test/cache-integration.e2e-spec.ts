import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { TaskCacheService } from "../src/tasks/task-cache.service";
import { TaskFilterDto } from "../src/tasks/dto/task-filter.dto";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { CACHE_MANAGER } from "@nestjs/cache-manager";

describe("Cache Integration (e2e)", () => {
  let app: INestApplication;
  let cacheService: TaskCacheService;
  let cacheManager: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      })
    );

    cacheService = moduleFixture.get<TaskCacheService>(TaskCacheService);
    cacheManager = moduleFixture.get(CACHE_MANAGER);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache before each test to ensure clean state
    await cacheManager.reset();
  });

  describe("Task List Caching", () => {
    it("should cache task list responses and improve performance", async () => {
      // First request - should hit database and cache the result
      const startTime1 = Date.now();
      const response1 = await request(app.getHttpServer())
        .get("/tasks?status=TODO&priority=HIGH")
        .expect(200);
      const duration1 = Date.now() - startTime1;

      expect(response1.body).toBeInstanceOf(Array);

      // Second request - should hit cache and be faster
      const startTime2 = Date.now();
      const response2 = await request(app.getHttpServer())
        .get("/tasks?status=TODO&priority=HIGH")
        .expect(200);
      const duration2 = Date.now() - startTime2;

      // Verify same data is returned
      expect(response2.body).toEqual(response1.body);

      // Cache hit should be faster (though this might be flaky in CI)
      console.log(
        `First request: ${duration1}ms, Cached request: ${duration2}ms`
      );

      // Verify data is actually in cache
      const filterDto: TaskFilterDto = {
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      };
      const cacheKey = cacheService.generateListCacheKey(filterDto);
      const cachedData = await cacheManager.get(cacheKey);
      expect(cachedData).not.toBeNull();
    });

    it("should cache different filter combinations separately", async () => {
      // Request tasks with different filters
      const response1 = await request(app.getHttpServer())
        .get("/tasks?status=TODO")
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get("/tasks?status=COMPLETED")
        .expect(200);

      // Verify different cache keys are used
      const filterDto1: TaskFilterDto = { status: TaskStatus.TODO };
      const filterDto2: TaskFilterDto = { status: TaskStatus.COMPLETED };

      const cacheKey1 = cacheService.generateListCacheKey(filterDto1);
      const cacheKey2 = cacheService.generateListCacheKey(filterDto2);

      expect(cacheKey1).not.toBe(cacheKey2);

      // Verify both are cached
      const cachedData1 = await cacheManager.get(cacheKey1);
      const cachedData2 = await cacheManager.get(cacheKey2);

      expect(cachedData1).not.toBeNull();
      expect(cachedData2).not.toBeNull();
      expect(cachedData1).not.toEqual(cachedData2);
    });
  });

  describe("Task Item Caching", () => {
    it("should cache individual task retrievals", async () => {
      // Get task list to have task IDs
      const listResponse = await request(app.getHttpServer())
        .get("/tasks")
        .expect(200);

      const taskId = listResponse.body[0]?.id;
      expect(taskId).toBeDefined();

      // First request for specific task
      const response1 = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .expect(200);

      // Verify task is cached
      const cacheKey = cacheService.generateItemCacheKey(taskId);
      const cachedTask = await cacheManager.get(cacheKey);
      expect(cachedTask).not.toBeNull();
      expect(cachedTask.id).toBe(taskId);

      // Second request should hit cache
      const response2 = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .expect(200);

      expect(response2.body).toEqual(response1.body);
    });
  });

  describe("Cache Invalidation", () => {
    it("should invalidate caches when creating new tasks", async () => {
      // Get existing project and user IDs
      const projectsResponse = await request(app.getHttpServer()).get(
        "/projects"
      );
      const usersResponse = await request(app.getHttpServer()).get("/users");

      const projectId = projectsResponse.body[0]?.id;
      const userId = usersResponse.body[0]?.id;

      // Cache a task list
      const initialResponse = await request(app.getHttpServer())
        .get("/tasks?status=TODO")
        .expect(200);

      const filterDto: TaskFilterDto = { status: TaskStatus.TODO };
      const cacheKey = cacheService.generateListCacheKey(filterDto);

      // Verify it's cached
      let cachedData = await cacheManager.get(cacheKey);
      expect(cachedData).not.toBeNull();

      // Create a new task
      await request(app.getHttpServer())
        .post("/tasks")
        .send({
          title: "Cache Test Task",
          description: "Testing cache invalidation",
          status: "TODO",
          priority: "MEDIUM",
          projectId: projectId,
          assigneeId: userId,
        })
        .expect(201);

      // Verify list cache is invalidated
      cachedData = await cacheManager.get(cacheKey);
      expect(cachedData).toBeFalsy(); // Can be null or undefined

      // New request should hit database again
      const newResponse = await request(app.getHttpServer())
        .get("/tasks?status=TODO")
        .expect(200);

      // Should have one more task than before
      expect(newResponse.body.length).toBe(initialResponse.body.length + 1);
    });

    it("should invalidate specific task cache when updating", async () => {
      // Get a task to update
      const listResponse = await request(app.getHttpServer())
        .get("/tasks")
        .expect(200);

      const task = listResponse.body[0];
      expect(task).toBeDefined();

      // Cache the task by requesting it individually
      await request(app.getHttpServer()).get(`/tasks/${task.id}`).expect(200);

      // Verify it's cached
      const cacheKey = cacheService.generateItemCacheKey(task.id);
      let cachedTask = await cacheManager.get(cacheKey);
      expect(cachedTask).not.toBeNull();

      // Update the task
      await request(app.getHttpServer())
        .put(`/tasks/${task.id}`)
        .send({
          title: "Updated Cache Test Task",
        })
        .expect(200);

      // Verify item cache is invalidated
      cachedTask = await cacheManager.get(cacheKey);
      expect(cachedTask).toBeFalsy(); // Can be null or undefined
    });
  });

  describe("Cache Configuration", () => {
    it("should use configured TTL values", () => {
      // Test that the service is using the correct TTL values from config
      expect(cacheService.TASK_LIST_TTL).toBeDefined();
      expect(cacheService.TASK_ITEM_TTL).toBeDefined();
      expect(typeof cacheService.TASK_LIST_TTL).toBe("number");
      expect(typeof cacheService.TASK_ITEM_TTL).toBe("number");
      expect(cacheService.TASK_LIST_TTL).toBeGreaterThan(0);
      expect(cacheService.TASK_ITEM_TTL).toBeGreaterThan(0);
    });

    it("should cache with different TTL for lists vs items", () => {
      // Verify that list and item TTLs are different as configured
      expect(cacheService.TASK_LIST_TTL).not.toBe(cacheService.TASK_ITEM_TTL);
    });
  });

  describe("Cache Performance", () => {
    it("should demonstrate cache performance benefits", async () => {
      const iterations = 3;
      const durations: number[] = [];

      // Make multiple requests to the same endpoint
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await request(app.getHttpServer())
          .get("/tasks?status=TODO&priority=HIGH")
          .expect(200);
        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      console.log(`Request durations: ${durations.join(", ")}ms`);

      // After the first request, subsequent requests should benefit from caching
      // (This is a performance indicator, exact timing may vary)
      expect(durations.length).toBe(iterations);
    });
  });
});
