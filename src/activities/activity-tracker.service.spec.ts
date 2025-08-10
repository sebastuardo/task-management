import { Test, TestingModule } from "@nestjs/testing";
import { ActivityTrackerService } from "./activity-tracker.service";

describe("ActivityTrackerService", () => {
  let service: ActivityTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityTrackerService],
    }).compile();

    service = module.get<ActivityTrackerService>(ActivityTrackerService);
  });

  describe("detectTaskChanges", () => {
    it("should detect title changes", () => {
      const oldTask = { title: "Old Title" };
      const newTask = { title: "New Title" };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        title: { old: "Old Title", new: "New Title" },
      });
    });

    it("should detect status changes", () => {
      const oldTask = { status: "TODO" };
      const newTask = { status: "IN_PROGRESS" };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        status: { old: "TODO", new: "IN_PROGRESS" },
      });
    });

    it("should detect priority changes", () => {
      const oldTask = { priority: "LOW" };
      const newTask = { priority: "HIGH" };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        priority: { old: "LOW", new: "HIGH" },
      });
    });

    it("should detect description changes", () => {
      const oldTask = { description: "Old description" };
      const newTask = { description: "New description" };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        description: { old: "Old description", new: "New description" },
      });
    });

    it("should detect dueDate changes", () => {
      const oldDate = new Date("2025-01-01");
      const newDate = new Date("2025-12-31");
      const oldTask = { dueDate: oldDate };
      const newTask = { dueDate: newDate };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        dueDate: { old: oldDate, new: newDate },
      });
    });

    it("should detect assigneeId changes", () => {
      const oldTask = { assigneeId: "user-123" };
      const newTask = { assigneeId: "user-456" };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        assigneeId: { old: "user-123", new: "user-456" },
      });
    });

    it("should detect assigneeId change from assigned to unassigned", () => {
      const oldTask = { assigneeId: "user-123" };
      const newTask = { assigneeId: null };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        assigneeId: { old: "user-123", new: null },
      });
    });

    it("should detect tag changes", () => {
      const oldTask = {
        tags: [{ id: "tag-1" }, { id: "tag-2" }],
      };
      const newTask = {
        tags: [{ id: "tag-2" }, { id: "tag-3" }],
      };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        tags: {
          old: ["tag-1", "tag-2"],
          new: ["tag-2", "tag-3"],
        },
      });
    });

    it("should detect multiple changes at once", () => {
      const oldTask = {
        title: "Old Title",
        status: "TODO",
        priority: "LOW",
        assigneeId: "user-123",
        tags: [{ id: "tag-1" }],
      };
      const newTask = {
        title: "New Title",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: "user-456",
        tags: [{ id: "tag-2" }],
      };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        title: { old: "Old Title", new: "New Title" },
        status: { old: "TODO", new: "IN_PROGRESS" },
        priority: { old: "LOW", new: "HIGH" },
        assigneeId: { old: "user-123", new: "user-456" },
        tags: { old: ["tag-1"], new: ["tag-2"] },
      });
    });

    it("should return empty object when no changes detected", () => {
      const task = {
        title: "Same Title",
        status: "TODO",
        priority: "MEDIUM",
        description: "Same description",
        assigneeId: "user-123",
        tags: [{ id: "tag-1" }],
      };

      const changes = service.detectTaskChanges(task, task);

      expect(changes).toEqual({});
    });

    it("should handle undefined/null values correctly", () => {
      const oldTask = {
        description: null,
        dueDate: undefined,
        assigneeId: null,
        tags: [],
      };
      const newTask = {
        description: "New description",
        dueDate: new Date("2025-12-31"),
        assigneeId: "user-123",
        tags: [{ id: "tag-1" }],
      };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        description: { old: null, new: "New description" },
        dueDate: { old: null, new: new Date("2025-12-31") },
        assigneeId: { old: null, new: "user-123" },
        tags: { old: [], new: ["tag-1"] },
      });
    });

    it("should normalize tag arrays correctly", () => {
      const oldTask = { tags: [] };
      const newTask = { tags: [{ id: "tag-1" }, { id: "tag-2" }] };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({
        tags: { old: [], new: ["tag-1", "tag-2"] },
      });
    });

    it("should ignore fields that are not being tracked", () => {
      const oldTask = {
        title: "Title",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        id: "task-123",
      };
      const newTask = {
        title: "Title",
        createdAt: new Date("2025-01-02"),
        updatedAt: new Date("2025-01-02"),
        id: "task-123",
      };

      const changes = service.detectTaskChanges(oldTask, newTask);

      expect(changes).toEqual({});
    });
  });

  describe("detectAssigneeChanges", () => {
    it("should detect assignee assignment", () => {
      const changes = service.detectAssigneeChanges(null, "user-123");

      expect(changes).toEqual({
        assigneeId: { old: null, new: "user-123" },
      });
    });

    it("should detect assignee reassignment", () => {
      const changes = service.detectAssigneeChanges("user-123", "user-456");

      expect(changes).toEqual({
        assigneeId: { old: "user-123", new: "user-456" },
      });
    });

    it("should detect assignee removal", () => {
      const changes = service.detectAssigneeChanges("user-123", null);

      expect(changes).toEqual({
        assigneeId: { old: "user-123", new: null },
      });
    });

    it("should return empty when assignee unchanged", () => {
      const changes = service.detectAssigneeChanges("user-123", "user-123");

      expect(changes).toEqual({});
    });
  });
});
