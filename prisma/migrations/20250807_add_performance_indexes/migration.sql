-- Add indexes for better query performance

-- Index for task filtering by status
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- Index for task filtering by priority
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- Index for task filtering by assigneeId
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- Index for task filtering by projectId
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- Index for task filtering by dueDate
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- Composite index for common filtering combinations
CREATE INDEX "Task_status_priority_idx" ON "Task"("status", "priority");
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- Index for date range queries
CREATE INDEX "Task_dueDate_status_idx" ON "Task"("dueDate", "status");
