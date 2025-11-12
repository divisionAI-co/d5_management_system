import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiEntityType } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ExecuteAiActionDto {
  @ApiProperty({ description: 'Entity instance to execute the action against', format: 'uuid' })
  @IsUUID()
  entityId!: string;

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

export class ExecuteAdhocAiActionDto {
  @ApiProperty({ enum: AiEntityType, description: 'Entity type the ad-hoc prompt will target' })
  @IsEnum(AiEntityType)
  entityType!: AiEntityType;

  @ApiProperty({ description: 'Entity identifier the ad-hoc prompt should use', format: 'uuid' })
  @IsUUID()
  entityId!: string;

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
}


