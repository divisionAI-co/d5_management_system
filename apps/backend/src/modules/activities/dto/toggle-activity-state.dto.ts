import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleActivityPinDto {
  @ApiProperty({ description: 'New pinned state' })
  @IsBoolean()
  isPinned!: boolean;
}

export class ToggleActivityCompletionDto {
  @ApiProperty({ description: 'New completion state' })
  @IsBoolean()
  isCompleted!: boolean;
}


