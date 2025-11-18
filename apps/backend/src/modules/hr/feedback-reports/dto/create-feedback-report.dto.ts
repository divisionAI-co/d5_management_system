import { IsInt, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackReportDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ description: 'Month (1-12)', minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ description: 'Year', minimum: 2020, maximum: 2100 })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;
}

