import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TemplateVariableDto {
  @ApiProperty({
    description: 'Unique identifier used inside the template (e.g. {{customerName}})',
    example: 'customerName',
  })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({
    description: 'Description of how this variable should be used',
    example: 'Full name of the customer receiving the email',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Sample value for previewing the template',
    example: 'Acme Corporation',
  })
  @IsOptional()
  sampleValue?: unknown;
}

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Human readable name for the template',
    example: 'Invoice Payment Reminder',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Type of template',
    enum: TemplateType,
    example: TemplateType.EMAIL,
  })
  @IsEnum(TemplateType)
  type!: TemplateType;

  @ApiProperty({
    description: 'Handlebars-compatible HTML that defines the template body',
    example: '<h1>Hello {{firstName}}</h1>',
  })
  @IsString()
  @IsNotEmpty()
  htmlContent!: string;

  @ApiPropertyOptional({
    description: 'Optional CSS styles injected into the template when rendered',
    example: 'h1 { color: #0f172a; }',
  })
  @IsOptional()
  @IsString()
  cssContent?: string;

  @ApiProperty({
    description: 'Variables available for this template',
    type: [TemplateVariableDto],
    example: [
      { key: 'firstName', description: 'Recipient first name', sampleValue: 'Jane' },
      { key: 'dueDate', description: 'Invoice due date in readable format', sampleValue: 'Dec 13, 2025' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables!: TemplateVariableDto[];

  @ApiPropertyOptional({
    description: 'Mark template as default for its type (only one default per type)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Determines if template can be used for rendering',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


