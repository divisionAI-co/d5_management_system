import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExchangeGoogleCalendarCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;
}


