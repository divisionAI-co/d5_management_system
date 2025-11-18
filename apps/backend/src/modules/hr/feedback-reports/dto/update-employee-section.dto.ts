import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmployeeSectionDto {
  @ApiProperty({ 
    description: 'Communication effectiveness rating (1-5)', 
    minimum: 1, 
    maximum: 5, 
    required: false 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  communicationRating?: number;

  @ApiProperty({ 
    description: 'Collaboration and teamwork rating (1-5)', 
    minimum: 1, 
    maximum: 5, 
    required: false 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  collaborationRating?: number;

  @ApiProperty({ 
    description: 'Task estimation rating (1-5)', 
    minimum: 1, 
    maximum: 5, 
    required: false 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  taskEstimationRating?: number;

  @ApiProperty({ 
    description: 'Timeliness and meeting deadlines rating (1-5)', 
    minimum: 1, 
    maximum: 5, 
    required: false 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  timelinessRating?: number;

  @ApiProperty({ description: 'Employee summary feedback of the month', required: false })
  @IsOptional()
  @IsString()
  employeeSummary?: string;
}

