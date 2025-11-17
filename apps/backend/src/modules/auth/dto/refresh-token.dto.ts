import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optional if using HttpOnly cookie)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}

