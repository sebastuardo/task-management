import { Injectable, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";
import { TaskFilterDto } from "./dto/task-filter.dto";
import { BaseCacheService, CacheKeyConfig } from "../common/cache";

@Injectable()
export class TaskCacheService extends BaseCacheService<any, TaskFilterDto> {
  protected readonly cacheConfig: CacheKeyConfig;

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    configService: ConfigService
  ) {
    super(cacheManager, configService);

    this.cacheConfig = {
      prefix: "tasks",
      listTtl: Number(this.configService.get("CACHE_TTL_TASK_LIST", 300000)),
      itemTtl: Number(this.configService.get("CACHE_TTL_TASK_ITEM", 600000)),
    };
  }

  get TASK_LIST_TTL(): number {
    return this.cacheConfig.listTtl;
  }

  get TASK_ITEM_TTL(): number {
    return this.cacheConfig.itemTtl;
  }

  async cacheTask(id: string, task: any): Promise<void> {
    return this.cacheItem(id, task);
  }

  async getCachedTask(id: string): Promise<any> {
    return this.getCachedItem(id);
  }

  async cacheTaskList(filterDto: TaskFilterDto, tasks: any[]): Promise<void> {
    return this.cacheList(filterDto, tasks);
  }

  async getCachedTaskList(filterDto: TaskFilterDto): Promise<any[]> {
    return this.getCachedList(filterDto);
  }

  async wrapTaskQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    return this.wrapQuery(cacheKey, queryFn, ttl);
  }

  async invalidateTaskCaches(id: string): Promise<void> {
    return this.invalidateAllCaches(id);
  }
}
