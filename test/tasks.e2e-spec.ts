import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("TasksController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    // Force close any remaining connections
    if (app) {
      await app.close();
    }
    // Give time for connections to fully close
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it("/tasks (GET) - should demonstrate N+1 query problem", async () => {
    // This test will show multiple queries being executed
    const response = await request(app.getHttpServer())
      .get("/tasks")
      .expect(200);

    // Check console output to see the number of queries executed
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);

    // Each task should have assignee, project, and tags
    response.body.forEach((task) => {
      expect(task).toHaveProperty("assignee");
      expect(task).toHaveProperty("project");
      expect(task).toHaveProperty("tags");
    });
  });

  it("/tasks (GET) - should demonstrate inefficient filtering", async () => {
    // This test shows that filtering happens in memory
    const startTime = Date.now();

    const response = await request(app.getHttpServer())
      .get("/tasks?status=TODO&priority=HIGH")
      .expect(200);

    const endTime = Date.now();

    // With in-memory filtering, this takes longer than necessary
    console.log(`Filtering took ${endTime - startTime}ms`);

    expect(response.body).toBeInstanceOf(Array);
    response.body.forEach((task) => {
      expect(task.status).toBe("TODO");
      expect(task.priority).toBe("HIGH");
    });
  });

  it("/tasks (POST) - should send email asynchronously without blocking", async () => {
    const startTime = Date.now();

    const response = await request(app.getHttpServer())
      .post("/tasks")
      .send({
        title: "Test Task",
        description: "Test Description",
        projectId: "44ddfd56-4846-4e54-a552-a7af2535ae89", // Valid project ID from seed
        assigneeId: "94217929-6631-4cd9-bcc0-d6bc55c0a96d", // Valid user ID from seed
      })
      .expect(201);

    const endTime = Date.now();

    // Response should be fast (async email)
    console.log(`Task creation took ${endTime - startTime}ms`);
    expect(endTime - startTime).toBeLessThan(500);

    // Wait for background email to complete to avoid Jest warnings
    await new Promise((resolve) => setTimeout(resolve, 2500));
  });
});
