import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiEntityType } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ExecuteAiActionDto {
  @ApiPropertyOptional({
    description: 'Entity instance to execute the action against. Omit to run on all records of the entity type.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Override the stored prompt template with a custom prompt for this execution',
    type: String,
  })
  @IsString()
  @IsOptional()
  promptOverride?: string;

  @ApiPropertyOptional({
    description: 'Additional instructions appended to the prompt template',
    type: String,
  })
  @IsString()
  @IsOptional()
  extraInstructions?: string;

  @ApiPropertyOptional({
    description: 'Subset of fields to send to Gemini (defaults to action configuration)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fieldKeys?: string[];
}

export class FieldMappingDto {
  @ApiProperty({ description: 'Source key in Gemini JSON response', example: 'functionalProposal' })
  @IsString()
  @IsNotEmpty()
  sourceKey!: string;

  @ApiProperty({ description: 'Target field in the database', example: 'functionalProposal' })
  @IsString()
  @IsNotEmpty()
  targetField!: string;

  @ApiPropertyOptional({ description: 'Optional transformation rule', type: String })
  @IsString()
  @IsOptional()
  transformRule?: string | null;
}

export class ExecuteAdhocAiActionDto {
  @ApiProperty({ enum: AiEntityType, description: 'Entity type the ad-hoc prompt will target' })
  @IsEnum(AiEntityType)
  entityType!: AiEntityType;

  @ApiPropertyOptional({
    description: 'Entity identifier the ad-hoc prompt should use. Omit to run on all records of the entity type.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiProperty({ description: 'Prompt to execute', type: String })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiProperty({
    description: 'Fields that should be included in the Gemini context',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  fieldKeys!: string[];

  @ApiPropertyOptional({
    description: 'Optional Gemini model override for this execution',
    example: 'gemini-1.5-pro-latest',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({
    description: 'Additional instructions appended to the prompt',
    type: String,
  })
  @IsString()
  @IsOptional()
  extraInstructions?: string;

  @ApiPropertyOptional({
    description: 'Operation type: UPDATE, CREATE, or READ_ONLY. Required if fieldMappings are provided.',
    enum: ['UPDATE', 'CREATE', 'READ_ONLY'],
    default: 'READ_ONLY',
  })
  @IsEnum(['UPDATE', 'CREATE', 'READ_ONLY'])
  @IsOptional()
  operationType?: 'UPDATE' | 'CREATE' | 'READ_ONLY';

  @ApiPropertyOptional({
    description: 'Field mappings for UPDATE/CREATE operations. Maps source keys in Gemini JSON response to target database fields.',
    type: [FieldMappingDto],
  })
  @IsArray()
  @IsOptional()
  fieldMappings?: FieldMappingDto[];
}


