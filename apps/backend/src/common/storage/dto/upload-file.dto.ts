import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({
    description: 'Optional blog ID to associate this file with',
  })
  @IsOptional()
  @IsUUID()
  blogId?: string;

  @ApiPropertyOptional({
    description: 'Optional case study ID to associate this file with',
  })
  @IsOptional()
  @IsUUID()
  caseStudyId?: string;
}

