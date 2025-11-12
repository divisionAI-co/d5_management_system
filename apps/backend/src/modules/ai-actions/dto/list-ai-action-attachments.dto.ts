import { ApiProperty } from '@nestjs/swagger';
import { AiEntityType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class ListAiActionAttachmentsDto {
  @ApiProperty({ enum: AiEntityType, description: 'Entity type to filter attachments by' })
  @IsEnum(AiEntityType)
  entityType!: AiEntityType;

  @ApiProperty({ format: 'uuid', description: 'Entity identifier to filter attachments by' })
  @IsUUID()
  entityId!: string;
}


