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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { EmployeesService } from '../employees/employees.service';
import { EodReportsService } from './eod-reports.service';
import { CreateEodReportDto } from './dto/create-eod-report.dto';
import { UpdateEodReportDto } from './dto/update-eod-report.dto';
import { FilterEodReportsDto } from './dto/filter-eod-reports.dto';

@ApiTags('HR - EOD Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/eod-reports')
export class EodReportsController {
  constructor(
    private readonly eodReportsService: EodReportsService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new EOD report' })
  async create(
    @Request() req: any,
    @Body() createDto: CreateEodReportDto,
  ) {
    const user = req.user;
    const isPrivileged =
      user.role === UserRole.ADMIN || user.role === UserRole.HR;

    let targetUserId: string;
    let targetEmployeeId: string;

    if (createDto.employeeId) {
      if (!isPrivileged) {
        throw new ForbiddenException('Only Admin or HR can submit on behalf of another employee');
      }
      const employee = await this.employeesService.findOne(createDto.employeeId);
      targetUserId = employee.userId;
      targetEmployeeId = employee.id;
    } else {
      const employee = await this.employeesService.findByUserId(user.id);
      targetUserId = user.id;
      targetEmployeeId = employee.id;
    }

    const { employeeId, ...payload } = createDto;

    return this.eodReportsService.create(targetUserId, targetEmployeeId, payload);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all EOD reports (paginated)' })
  findAll(@Query() filters: FilterEodReportsDto) {
    return this.eodReportsService.findAll(filters);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user EOD reports (paginated)' })
  async findMine(
    @Request() req: any,
    @Query() filters: FilterEodReportsDto,
  ) {
    const user = req.user;
    await this.employeesService.findByUserId(user.id);
    return this.eodReportsService.findAll({ ...filters, userId: user.id });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get EOD report by ID' })
  findOne(@Param('id') id: string) {
    return this.eodReportsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an EOD report' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateDto: UpdateEodReportDto,
  ) {
    const user = req.user;
    const canManageOthers = user.role === UserRole.ADMIN || user.role === UserRole.HR;
    return this.eodReportsService.update(id, user.id, updateDto, canManageOthers);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete an EOD report' })
  remove(@Param('id') id: string) {
    return this.eodReportsService.remove(id);
  }
}


