import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAmSectionDto {
  @ApiProperty({ description: 'Account Manager feedback text', required: false })
  @IsOptional()
  @IsString()
  amFeedback?: string;
}

