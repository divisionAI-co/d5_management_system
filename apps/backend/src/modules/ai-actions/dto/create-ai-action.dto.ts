import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiActionOperationType, AiCollectionFormat, AiCollectionKey, AiEntityType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AiActionFieldInputDto {
  @ApiProperty({ description: 'Unique key representing the field', example: 'fullName' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fieldKey!: string;

  @ApiProperty({ description: 'Human-friendly label shown in the UI', example: 'Full name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fieldLabel!: string;

  @ApiPropertyOptional({ description: 'Optional metadata to help rendering/formatting in prompts' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Display order when presenting fields', example: 0 })
  @IsOptional()
  order?: number;
}

export class AiActionCollectionDto {
  @ApiProperty({ enum: AiCollectionKey, description: 'Related data source to include' })
  @IsEnum(AiCollectionKey)
  collectionKey!: AiCollectionKey;

  @ApiPropertyOptional({
    enum: AiCollectionFormat,
    description: 'Display format for this collection',
    default: AiCollectionFormat.TABLE,
  })
  @IsEnum(AiCollectionFormat)
  @IsOptional()
  format?: AiCollectionFormat;

  @ApiPropertyOptional({ description: 'Maximum number of rows to include', example: 5, default: 5 })
  @IsInt()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Additional rendering options',
    type: Object,
  })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'Fields to include for each row',
    type: [AiActionFieldInputDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AiActionFieldInputDto)
  fields!: AiActionFieldInputDto[];
}

export class AiActionFieldMappingDto {
  @ApiProperty({
    description: 'Key from Gemini JSON response to extract',
    example: 'extractedSkills',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sourceKey!: string;

  @ApiProperty({
    description: 'Database field to update/create',
    example: 'skills',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetField!: string;

  @ApiPropertyOptional({
    description: 'Optional transformation rule (e.g., JSON path)',
    example: 'json:["skills"]',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  transformRule?: string;

  @ApiPropertyOptional({ description: 'Display order', example: 0 })
  @IsInt()
  @IsOptional()
  order?: number;
}

export class CreateAiActionDto {
  @ApiProperty({ description: 'Name of the Gemini action shown to users', example: 'Summarise candidate profile' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description to add context', example: 'Creates a 3 bullet summary.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Prompt template containing placeholders such as {{fullName}}', type: String })
  @IsString()
  @IsNotEmpty()
  promptTemplate!: string;

  @ApiProperty({
    enum: AiEntityType,
    description: 'Entity type this action can be executed against',
    example: AiEntityType.CANDIDATE,
  })
  @IsEnum(AiEntityType)
  entityType!: AiEntityType;

  @ApiPropertyOptional({
    description: 'Optional Gemini model override (defaults to configured model)',
    example: 'gemini-1.5-pro-latest',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ description: 'Enable or disable the action', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Fields that will be injected into the prompt template',
    type: [AiActionFieldInputDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AiActionFieldInputDto)
  fields!: AiActionFieldInputDto[];

  @ApiPropertyOptional({
    description: 'Related collections (multi-row data) to include in prompt',
    type: [AiActionCollectionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiActionCollectionDto)
  @IsOptional()
  collections?: AiActionCollectionDto[];

  @ApiPropertyOptional({
    enum: AiActionOperationType,
    description: 'Operation type: READ_ONLY (default), UPDATE (edit existing), or CREATE (generate new)',
    default: AiActionOperationType.READ_ONLY,
    example: AiActionOperationType.UPDATE,
  })
  @IsEnum(AiActionOperationType)
  @IsOptional()
  operationType?: AiActionOperationType;

  @ApiPropertyOptional({
    description: 'Field mappings for UPDATE/CREATE operations (maps Gemini response keys to database fields)',
    type: [AiActionFieldMappingDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiActionFieldMappingDto)
  @IsOptional()
  fieldMappings?: AiActionFieldMappingDto[];
}


