import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDriveFilesDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  pageToken?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
  })
  recursive?: boolean;
}



