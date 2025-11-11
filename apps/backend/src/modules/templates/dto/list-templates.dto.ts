import { ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListTemplatesDto {
  @ApiPropertyOptional({
    description: 'Filter templates by type',
    enum: TemplateType,
    example: TemplateType.EMAIL,
  })
  @IsOptional()
  @IsEnum(TemplateType)
  type?: TemplateType;

  @ApiPropertyOptional({
    description: 'Only include templates that are active',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }

    return Boolean(value);
  })
  @IsBoolean()
  onlyActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search templates by name (case-insensitive contains)',
    example: 'invoice',
  })
  @IsOptional()
  @IsString()
  search?: string;
}


