import { Injectable, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { TaskFilterDto } from "./dto/task-filter.dto";
import * as crypto from "crypto";

@Injectable()
export class TaskCacheService {
  // Cache TTL constants (in milliseconds for cache-manager-redis-yet)
  public readonly TASK_LIST_TTL = 300 * 1000; // 5 minutes in milliseconds
  public readonly TASK_ITEM_TTL = 600 * 1000; // 10 minutes in milliseconds

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  generateListCacheKey(filterDto: TaskFilterDto): string {
    const filterString = JSON.stringify(
      filterDto,
      Object.keys(filterDto).sort()
    );
    const hash = crypto.createHash("md5").update(filterString).digest("hex");
    return `tasks:list:${hash}`;
  }

  generateItemCacheKey(id: string): string {
    return `tasks:item:${id}`;
  }

  async cacheTask(id: string, task: any): Promise<void> {
    try {
      const cacheKey = this.generateItemCacheKey(id);
      await this.cacheManager.set(cacheKey, task, this.TASK_ITEM_TTL);
    } catch (error) {
      console.error("Cache set error for task:", error.message);
    }
  }

  async getCachedTask(id: string): Promise<any> {
    try {
      const cacheKey = this.generateItemCacheKey(id);
      return await this.cacheManager.get(cacheKey);
    } catch (error) {
      console.error("Cache get error for task:", error.message);
      return null;
    }
  }

  async cacheTaskList(filterDto: TaskFilterDto, tasks: any[]): Promise<void> {
    try {
      const cacheKey = this.generateListCacheKey(filterDto);
      await this.cacheManager.set(cacheKey, tasks, this.TASK_LIST_TTL);
    } catch (error) {
      console.error("Cache set error for task list:", error.message);
    }
  }

  async getCachedTaskList(filterDto: TaskFilterDto): Promise<any[]> {
    try {
      const cacheKey = this.generateListCacheKey(filterDto);
      return await this.cacheManager.get(cacheKey);
    } catch (error) {
      console.error("Cache get error for task list:", error.message);
      return null;
    }
  }

  async wrapTaskQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    return await this.cacheManager.wrap(cacheKey, queryFn, ttl);
  }

  async invalidateListCaches(): Promise<void> {
    try {
      const store = this.cacheManager.store as any;
      if (store && store.keys) {
        const keys = await store.keys("tasks:list:*");
        for (const key of keys) {
          await this.cacheManager.del(key);
        }
      }
    } catch (error) {
      console.error("Error invalidating list caches:", error);
    }
  }

  async invalidateItemCache(id: string): Promise<void> {
    try {
      const key = this.generateItemCacheKey(id);
      await this.cacheManager.del(key);
    } catch (error) {
      console.error("Error invalidating item cache:", error);
    }
  }

  async invalidateTaskCaches(id: string): Promise<void> {
    await Promise.all([
      this.invalidateItemCache(id),
      this.invalidateListCaches(),
    ]);
  }
}
