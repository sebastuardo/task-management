import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";
import * as crypto from "crypto";

export interface CacheKeyConfig {
  prefix: string;
  listTtl: number;
  itemTtl: number;
}

@Injectable()
export abstract class BaseCacheService<TEntity = any, TFilter = any> {
  protected abstract readonly cacheConfig: CacheKeyConfig;

  constructor(
    @Inject(CACHE_MANAGER) protected readonly cacheManager: Cache,
    protected readonly configService: ConfigService
  ) {}

  generateListCacheKey(filterDto: TFilter): string {
    const filterString = JSON.stringify(
      filterDto,
      Object.keys(filterDto as any).sort()
    );
    const hash = crypto.createHash("md5").update(filterString).digest("hex");
    return `${this.cacheConfig.prefix}:list:${hash}`;
  }

  generateItemCacheKey(id: string): string {
    return `${this.cacheConfig.prefix}:item:${id}`;
  }

  async cacheItem(id: string, item: TEntity): Promise<void> {
    try {
      const cacheKey = this.generateItemCacheKey(id);
      await this.cacheManager.set(cacheKey, item, this.cacheConfig.itemTtl);
    } catch (error) {
      console.error(
        `Cache set error for ${this.cacheConfig.prefix} item:`,
        error.message
      );
    }
  }

  async getCachedItem(id: string): Promise<TEntity | null> {
    try {
      const cacheKey = this.generateItemCacheKey(id);
      return await this.cacheManager.get(cacheKey);
    } catch (error) {
      console.error(
        `Cache get error for ${this.cacheConfig.prefix} item:`,
        error.message
      );
      return null;
    }
  }

  async cacheList(filterDto: TFilter, items: TEntity[]): Promise<void> {
    try {
      const cacheKey = this.generateListCacheKey(filterDto);
      await this.cacheManager.set(cacheKey, items, this.cacheConfig.listTtl);
    } catch (error) {
      console.error(
        `Cache set error for ${this.cacheConfig.prefix} list:`,
        error.message
      );
    }
  }

  async getCachedList(filterDto: TFilter): Promise<TEntity[] | null> {
    try {
      const cacheKey = this.generateListCacheKey(filterDto);
      return await this.cacheManager.get(cacheKey);
    } catch (error) {
      console.error(
        `Cache get error for ${this.cacheConfig.prefix} list:`,
        error.message
      );
      return null;
    }
  }

  async wrapQuery<T>(
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
        const pattern = `${this.cacheConfig.prefix}:list:*`;
        const keys = await store.keys(pattern);
        for (const key of keys) {
          await this.cacheManager.del(key);
        }
      }
    } catch (error) {
      console.error(
        `Error invalidating ${this.cacheConfig.prefix} list caches:`,
        error
      );
    }
  }

  async invalidateItemCache(id: string): Promise<void> {
    try {
      const key = this.generateItemCacheKey(id);
      await this.cacheManager.del(key);
    } catch (error) {
      console.error(
        `Error invalidating ${this.cacheConfig.prefix} item cache:`,
        error
      );
    }
  }

  async invalidateAllCaches(id: string): Promise<void> {
    await Promise.all([
      this.invalidateItemCache(id),
      this.invalidateListCaches(),
    ]);
  }

  async clearAllCaches(): Promise<void> {
    try {
      const store = this.cacheManager.store as any;
      if (store && store.keys) {
        const pattern = `${this.cacheConfig.prefix}:*`;
        const keys = await store.keys(pattern);
        for (const key of keys) {
          await this.cacheManager.del(key);
        }
      }
    } catch (error) {
      console.error(
        `Error clearing all ${this.cacheConfig.prefix} caches:`,
        error
      );
    }
  }
}
