import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('HR - Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new employee' })
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all employees' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  findAll(
    @Query('status') status?: string,
    @Query('department') department?: string,
  ) {
    const filters: any = {};
    
    if (status) {
      filters.status = status;
    }
    
    if (department) {
      filters.department = department;
    }

    return this.employeesService.findAll(filters);
  }

  @Get('departments')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get list of departments' })
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get employee statistics' })
  getStats(@Param('id') id: string) {
    return this.employeesService.getEmployeeStats(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get employee by user ID' })
  findByUserId(@Param('userId') userId: string) {
    return this.employeesService.findByUserId(userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update employee' })
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete employee' })
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}

