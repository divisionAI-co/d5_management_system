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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { FilterOpportunitiesDto } from './dto/filter-opportunities.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { CloseOpportunityDto } from './dto/close-opportunity.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('CRM - Opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm/opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.SALESPERSON,
    UserRole.ACCOUNT_MANAGER,
    UserRole.RECRUITER,
  )
  @ApiOperation({ summary: 'List opportunities with filtering and pagination' })
  findAll(@Query() filters: FilterOpportunitiesDto) {
    return this.opportunitiesService.findAll(filters);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.SALESPERSON,
    UserRole.ACCOUNT_MANAGER,
    UserRole.RECRUITER,
  )
  @ApiOperation({ summary: 'Get opportunity details' })
  findOne(@Param('id') id: string) {
    return this.opportunitiesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary:
      'Create a new opportunity. Staff augmentation opportunities will automatically create an open position.',
  })
  create(@Body() createDto: CreateOpportunityDto) {
    return this.opportunitiesService.create(createDto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update an existing opportunity' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(id, updateDto);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON)
  @ApiOperation({
    summary: 'Close an opportunity as won or lost',
  })
  close(@Param('id') id: string, @Body() closeDto: CloseOpportunityDto) {
    return this.opportunitiesService.close(id, closeDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an opportunity' })
  remove(@Param('id') id: string) {
    return this.opportunitiesService.remove(id);
  }
}


