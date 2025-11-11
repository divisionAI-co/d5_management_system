import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'Whether the user account should be active',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;
}


