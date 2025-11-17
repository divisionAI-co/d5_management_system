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
import { SendOpportunityEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
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
  create(
    @Body() createDto: CreateOpportunityDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.opportunitiesService.create(createDto, userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update an existing opportunity' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOpportunityDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.opportunitiesService.update(id, updateDto, userId);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON)
  @ApiOperation({
    summary: 'Close an opportunity as won or lost',
  })
  close(@Param('id') id: string, @Body() closeDto: CloseOpportunityDto) {
    return this.opportunitiesService.close(id, closeDto);
  }

  @Post(':id/send-email')
  @Roles(
    UserRole.ADMIN,
    UserRole.SALESPERSON,
    UserRole.ACCOUNT_MANAGER,
  )
  @ApiOperation({
    summary: 'Send an email related to an opportunity',
    description:
      'Send an email using a template or custom content. Either templateId or htmlContent must be provided.',
  })
  sendEmail(@Param('id') id: string, @Body() dto: SendOpportunityEmailDto) {
    return this.opportunitiesService.sendEmail(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an opportunity' })
  remove(@Param('id') id: string) {
    return this.opportunitiesService.remove(id);
  }
}


