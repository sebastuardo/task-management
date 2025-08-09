import { Injectable, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";
import { BaseCacheService, CacheKeyConfig } from "../common/cache";

// Ejemplo de filtro para proyectos (simplificado)
interface ProjectFilterDto {
  name?: string;
  status?: string;
}

@Injectable()
export class ProjectCacheService extends BaseCacheService<
  any,
  ProjectFilterDto
> {
  protected readonly cacheConfig: CacheKeyConfig;

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    configService: ConfigService
  ) {
    super(cacheManager, configService);

    this.cacheConfig = {
      prefix: "projects",
      listTtl: this.configService.get<number>("CACHE_TTL_PROJECT_LIST", 600000), // 10 min
      itemTtl: this.configService.get<number>(
        "CACHE_TTL_PROJECT_ITEM",
        1800000
      ), // 30 min
    };
  }
}
