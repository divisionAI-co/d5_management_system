import { IsOptional, IsString } from 'class-validator';

export class GetGoogleCalendarAuthUrlDto {
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  state?: string;
}


