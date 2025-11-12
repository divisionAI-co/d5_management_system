import { ApiPropertyOptional } from '@nestjs/swagger';
import { AiEntityType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class ListAiActionExecutionsDto {
  @ApiPropertyOptional({ enum: AiEntityType, description: 'Restrict executions to a specific entity type' })
  @IsEnum(AiEntityType)
  @IsOptional()
  entityType?: AiEntityType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict executions to a specific entity instance' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict executions to a specific Gemini action' })
  @IsUUID()
  @IsOptional()
  actionId?: string;

  @ApiPropertyOptional({ description: 'Maximum number of results to return', default: 20, minimum: 1, maximum: 100 })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}


