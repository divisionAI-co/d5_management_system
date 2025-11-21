import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { FilterActivitiesDto } from './dto/filter-activities.dto';
import {
  ToggleActivityCompletionDto,
  ToggleActivityPinDto,
} from './dto/toggle-activity-state.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  // Activity Records --------------------------------------------------------

  @Post('activities')
  @ApiOperation({ summary: 'Create a new activity record' })
  async create(
    @Body() createActivityDto: CreateActivityDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.activitiesService.create(createActivityDto, userId);
  }

  @Get('activities')
  @ApiOperation({ summary: 'List activities with filtering options' })
  async findAll(@Query() filters: FilterActivitiesDto) {
    return this.activitiesService.findAll(filters);
  }

  @Get('activities/:id')
  @ApiOperation({ summary: 'Get a single activity by ID' })
  async findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Update an existing activity' })
  async update(@Param('id') id: string, @Body() updateActivityDto: UpdateActivityDto) {
    return this.activitiesService.update(id, updateActivityDto);
  }

  @Patch('activities/:id/pin')
  @ApiOperation({ summary: 'Pin or unpin an activity' })
  async togglePin(@Param('id') id: string, @Body() payload: ToggleActivityPinDto) {
    return this.activitiesService.togglePin(id, payload.isPinned);
  }

  @Patch('activities/:id/complete')
  @ApiOperation({ summary: 'Mark an activity as complete/incomplete' })
  async complete(@Param('id') id: string, @Body() payload: ToggleActivityCompletionDto) {
    return this.activitiesService.complete(id, payload.isCompleted);
  }

  @Delete('activities/:id')
  @ApiOperation({ summary: 'Delete an activity' })
  async remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }

  // Activity Types ----------------------------------------------------------

  @Get('settings/activity-types')
  @ApiOperation({ summary: 'List activity types (readable by all authenticated users)' })
  async listActivityTypes(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.activitiesService.listActivityTypes(include);
  }

  @Post('settings/activity-types')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new activity type' })
  async createActivityType(
    @Body() createActivityTypeDto: CreateActivityTypeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.activitiesService.createActivityType(createActivityTypeDto, userId);
  }

  @Patch('settings/activity-types/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an activity type' })
  async updateActivityType(
    @Param('id') id: string,
    @Body() updateActivityTypeDto: UpdateActivityTypeDto,
  ) {
    return this.activitiesService.updateActivityType(id, updateActivityTypeDto);
  }

  @Delete('settings/activity-types/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an activity type (if unused)' })
  async deleteActivityType(@Param('id') id: string) {
    return this.activitiesService.deleteActivityType(id);
  }
}


