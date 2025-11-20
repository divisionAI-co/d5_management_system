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
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { UpdateCheckInDto } from './dto/update-check-in.dto';
import { FilterCheckInsDto } from './dto/filter-check-ins.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { EmployeesService } from '../employees/employees.service';

@ApiTags('HR - Check-ins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/check-ins')
export class CheckInsController {
  constructor(
    private readonly checkInsService: CheckInsService,
    private readonly employeesService: EmployeesService,
  ) {}

  private isPrivileged(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.HR;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new check-in/check-out record' })
  create(@Body() createCheckInDto: CreateCheckInDto) {
    return this.checkInsService.create(createCheckInDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.RECRUITER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get all check-ins with filters and pagination' })
  async findAll(@Request() req: any, @Query() filters: FilterCheckInsDto) {
    const user = req.user;
    
    // ADMIN and HR can see all check-ins
    if (this.isPrivileged(user.role)) {
      return this.checkInsService.findAll(filters);
    }
    
    // Other roles can only see their own check-ins
    const employee = await this.employeesService.findByUserId(user.id);
    
    // If they try to filter by a different employee, deny access
    if (filters.employeeId && filters.employeeId !== employee.id) {
      throw new ForbiddenException('You can only view your own check-ins.');
    }
    
    // Force filter to their own employee ID
    return this.checkInsService.findAll({ ...filters, employeeId: employee.id });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.RECRUITER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get check-in by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    const checkIn = await this.checkInsService.findOne(id);
    
    // ADMIN and HR can see any check-in
    if (this.isPrivileged(user.role)) {
      return checkIn;
    }
    
    // Other roles can only see their own check-ins
    const employee = await this.employeesService.findByUserId(user.id);
    
    if (checkIn.employeeId !== employee.id) {
      throw new ForbiddenException('You can only view your own check-ins.');
    }
    
    return checkIn;
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update check-in record' })
  update(
    @Param('id') id: string,
    @Body() updateCheckInDto: UpdateCheckInDto,
  ) {
    return this.checkInsService.update(id, updateCheckInDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete check-in record' })
  remove(@Param('id') id: string) {
    return this.checkInsService.remove(id);
  }
}

