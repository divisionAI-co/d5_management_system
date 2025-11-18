import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { GoogleCalendarService } from './google-calendar.service';
import { GetGoogleCalendarAuthUrlDto } from './dto/get-google-calendar-auth-url.dto';
import { ExchangeGoogleCalendarCodeDto } from './dto/exchange-google-calendar-code.dto';
import { CreateGoogleCalendarEventDto } from './dto/create-google-calendar-event.dto';
import { ListGoogleCalendarEventsDto } from './dto/list-google-calendar-events.dto';

@ApiTags('Integrations - Google Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendar/google')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Get Google Calendar connection status for current user' })
  getStatus(@CurrentUser('id') userId: string) {
    return this.googleCalendarService.getConnectionStatus(userId);
  }

  @Get('auth-url')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Generate Google Calendar OAuth authorization URL' })
  async getAuthUrl(@Query() query: GetGoogleCalendarAuthUrlDto) {
    const url = await this.googleCalendarService.generateAuthUrl(query.redirectUri, query.state);
    return { url };
  }

  @Post('exchange')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Exchange Google authorization code for access tokens' })
  exchangeCode(
    @CurrentUser('id') userId: string,
    @Body() dto: ExchangeGoogleCalendarCodeDto,
  ) {
    return this.googleCalendarService.exchangeCode(userId, dto.code, dto.redirectUri);
  }

  @Post('events')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Create a new Google Calendar event for current user' })
  createEvent(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGoogleCalendarEventDto,
  ) {
    return this.googleCalendarService.createEvent(userId, dto);
  }

  @Get('events')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'List upcoming events from connected Google Calendar' })
  @ApiQuery({ name: 'timeMin', required: false, description: 'ISO8601 start of time range' })
  @ApiQuery({ name: 'timeMax', required: false, description: 'ISO8601 end of time range' })
  @ApiQuery({
    name: 'maxResults',
    required: false,
    description: 'Maximum number of events to return (1-250)',
    type: Number,
  })
  listEvents(
    @CurrentUser('id') userId: string,
    @Query() query: ListGoogleCalendarEventsDto,
  ) {
    return this.googleCalendarService.listEvents(userId, {
      timeMin: query.timeMin ? new Date(query.timeMin) : undefined,
      timeMax: query.timeMax ? new Date(query.timeMax) : undefined,
      maxResults: query.maxResults ?? undefined,
    });
  }

  @Delete('disconnect')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Disconnect Google Calendar from current user account' })
  disconnect(@CurrentUser('id') userId: string) {
    return this.googleCalendarService.disconnect(userId);
  }
}


