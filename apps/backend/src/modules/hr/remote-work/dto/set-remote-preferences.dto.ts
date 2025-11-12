import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class SetRemotePreferencesDto {
  @ApiProperty({
    type: [String],
    description: 'List of ISO dates within the active window the employee will work remotely.',
  })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(7)
  @IsDateString({}, { each: true })
  dates!: string[];

  @ApiPropertyOptional({
    description: 'Optional note that will be saved on each remote work log.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

