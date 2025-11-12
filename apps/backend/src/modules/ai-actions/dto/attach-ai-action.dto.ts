import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AttachAiActionDto {
  @ApiProperty({ description: 'Identifier of the entity instance to attach to', format: 'uuid' })
  @IsUUID()
  entityId!: string;
}

export class DetachAiActionDto {
  @ApiProperty({ description: 'Identifier of the attachment to remove', format: 'uuid' })
  @IsString()
  attachmentId!: string;
}


