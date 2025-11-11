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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('CRM - Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Create a new customer' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'List customers with filtering and pagination' })
  findAll(@Query() filters: FilterCustomersDto) {
    return this.customersService.findAll(filters);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get customer details' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update customer details' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update customer status or sentiment' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateCustomerStatusDto,
  ) {
    return this.customersService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete customer' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Get(':id/activities')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get recent activities for a customer' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Number of activities to return' })
  getActivities(
    @Param('id') id: string,
    @Query('take') take?: string,
  ) {
    const limit = take ? Math.min(Math.max(Number(take), 1), 100) : 20;
    return this.customersService.getCustomerActivities(id, limit);
  }

  @Get(':id/opportunities')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get opportunities for a customer' })
  getOpportunities(@Param('id') id: string) {
    return this.customersService.getCustomerOpportunities(id);
  }
}


