import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

class GoogleCalendarEventDateDto {
  @ValidateIf((value) => value.date === undefined || value.date === null)
  @IsString()
  dateTime?: string;

  @ValidateIf((value) => value.dateTime === undefined || value.dateTime === null)
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;
}

class GoogleCalendarEventAttendeeDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  optional?: boolean;
}

export class CreateGoogleCalendarEventDto {
  @IsString()
  @IsNotEmpty()
  summary!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @ValidateNested()
  @Type(() => GoogleCalendarEventDateDto)
  start!: GoogleCalendarEventDateDto;

  @ValidateNested()
  @Type(() => GoogleCalendarEventDateDto)
  end!: GoogleCalendarEventDateDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GoogleCalendarEventAttendeeDto)
  attendees?: GoogleCalendarEventAttendeeDto[];
}


