import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({
    description: 'New password for the user',
    minLength: 8,
    example: 'SecurePassw0rd!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}


