import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ActivityAction } from "@prisma/client";

export class ActivityFilterDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  perPage?: number = 20;
}
