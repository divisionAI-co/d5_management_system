import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateActivityTypeDto {
  @ApiProperty({ description: 'Display name of the activity type' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Unique key for internal reference', example: 'FOLLOW_UP' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({ description: 'Longer description to help teammates' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Hex color used in UI badges', example: '#2563EB' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon identifier used on the frontend', example: 'Bell' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Whether the type is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Ordering weight for list displays', default: 0 })
  @IsOptional()
  order?: number;
}


