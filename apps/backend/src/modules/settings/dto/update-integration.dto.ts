import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateIntegrationDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}


