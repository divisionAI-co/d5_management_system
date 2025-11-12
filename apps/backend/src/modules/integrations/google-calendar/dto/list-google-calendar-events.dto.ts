import { Transform } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListGoogleCalendarEventsDto {
  @IsOptional()
  @IsISO8601()
  timeMin?: string;

  @IsOptional()
  @IsISO8601()
  timeMax?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  @Max(250)
  maxResults?: number;
}


