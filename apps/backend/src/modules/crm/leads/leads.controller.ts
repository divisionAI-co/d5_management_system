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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { FilterLeadsDto } from './dto/filter-leads.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('CRM - Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Create a new lead' })
  create(@Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(createLeadDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'List leads with filtering and pagination' })
  findAll(@Query() filters: FilterLeadsDto) {
    return this.leadsService.findAll(filters);
  }

  @Get('lookup/contacts')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Lookup contacts that can be associated with a lead' })
  @ApiQuery({ name: 'search', required: false, type: String })
  listContacts(@Query('search') search?: string) {
    return this.leadsService.listContacts(search);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Get lead details' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Update lead details' })
  update(@Param('id') id: string, @Body() updateLeadDto: UpdateLeadDto) {
    return this.leadsService.update(id, updateLeadDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Update lead status/probability' })
  updateStatus(@Param('id') id: string, @Body() statusDto: UpdateLeadStatusDto) {
    return this.leadsService.updateStatus(id, statusDto);
  }

  @Post(':id/convert')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Convert a lead into a customer' })
  convert(@Param('id') id: string, @Body() convertDto: ConvertLeadDto) {
    return this.leadsService.convert(id, convertDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Delete a lead' })
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}
