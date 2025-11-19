import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { EmployeesService } from '../employees/employees.service';

@ApiTags('HR - Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/leave-requests')
export class LeaveRequestsController {
  constructor(
    private readonly leaveService: LeaveRequestsService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new leave request' })
  async create(
    @Request() req: any,
    @Body() createLeaveDto: CreateLeaveRequestDto,
  ) {
    // Get employee from user
    const user = req.user;
    const isPrivileged =
      user.role === UserRole.ADMIN || user.role === UserRole.HR;

    let targetEmployee: Awaited<ReturnType<typeof this.employeesService.findByUserId>>;

    if (createLeaveDto.employeeId) {
      if (!isPrivileged) {
        throw new ForbiddenException('Only Admin or HR can submit leave on behalf of another employee');
      }
      targetEmployee = await this.employeesService.findOne(createLeaveDto.employeeId);
    } else {
      targetEmployee = await this.employeesService.findByUserId(user.id);
    }

    const { employeeId: _employeeId, ...payload } = createLeaveDto;

    return this.leaveService.create(
      targetEmployee.userId,
      targetEmployee.id,
      payload,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all leave requests' })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    
    if (employeeId) {
      filters.employeeId = employeeId;
    }
    
    if (status) {
      filters.status = status;
    }

    if (startDate) {
      filters.startDate = startDate;
    }

    if (endDate) {
      filters.endDate = endDate;
    }

    return this.leaveService.findAll(filters);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get pending leave requests' })
  getPending() {
    return this.leaveService.getPendingRequests();
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get current user leave requests' })
  async getMyRequests(@Request() req: any) {
    const user = req.user;
    const employee = await this.employeesService.findByUserId(user.id);

    return this.leaveService.findAll({ employeeId: employee.id });
  }

  @Get('balance/:employeeId')
  @ApiOperation({ summary: 'Get employee leave balance' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getBalance(
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
  ) {
    const targetYear = year ? parseInt(year, 10) : undefined;
    return this.leaveService.getEmployeeLeaveBalance(employeeId, targetYear);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  findOne(@Param('id') id: string) {
    return this.leaveService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update leave request' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateLeaveDto: UpdateLeaveRequestDto,
  ) {
    const user = req.user;
    const employee = await this.employeesService.findByUserId(user.id);

    return this.leaveService.update(id, employee.id, updateLeaveDto);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Approve or reject leave request' })
  approve(
    @Param('id') id: string,
    @Request() req: any,
    @Body() approveDto: ApproveLeaveDto,
  ) {
    return this.leaveService.approve(id, req.user.id, approveDto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel leave request' })
  async cancel(@Param('id') id: string, @Request() req: any) {
    const user = req.user;
    const employee = await this.employeesService.findByUserId(user.id);

    return this.leaveService.cancel(id, employee.id);
  }
}
