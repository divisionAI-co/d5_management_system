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
  ApiResponse,
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
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('CRM - Customers')
@Controller('crm/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // ============================================
  // PUBLIC ENDPOINTS (for website showcase)
  // ============================================

  @Public()
  @Get('public/logos')
  @ApiOperation({
    summary: 'Get customer logos for public website (no authentication required)',
    description: 'Returns customer logos for active customers. Suitable for displaying customer logos on your website.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of customer logos',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          imageUrl: { type: 'string' },
          website: { type: 'string', nullable: true },
        },
      },
    },
  })
  getPublicLogos() {
    return this.customersService.getPublicLogos();
  }

  // ============================================
  // PROTECTED ENDPOINTS (for CRM management)
  // ============================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new customer' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List customers with filtering and pagination' })
  findAll(@Query() filters: FilterCustomersDto) {
    return this.customersService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer details' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update customer details' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update customer status or sentiment' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateCustomerStatusDto,
  ) {
    return this.customersService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete customer' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Get(':id/activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get opportunities for a customer' })
  getOpportunities(@Param('id') id: string) {
    return this.customersService.getCustomerOpportunities(id);
  }
}


