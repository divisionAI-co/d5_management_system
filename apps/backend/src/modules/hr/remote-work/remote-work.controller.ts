import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RemoteWorkService } from './remote-work.service';
import { CreateRemoteWorkLogDto } from './dto/create-remote-work-log.dto';
import { UpdateRemoteWorkPolicyDto } from './dto/update-remote-work-policy.dto';
import { EmployeesService } from '../employees/employees.service';
import { OpenRemoteWindowDto } from './dto/open-remote-window.dto';
import { SetRemotePreferencesDto } from './dto/set-remote-preferences.dto';

@ApiTags('HR - Remote Work')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/remote-work')
export class RemoteWorkController {
  constructor(
    private readonly remoteWorkService: RemoteWorkService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Post('logs')
  @ApiOperation({ summary: 'Log a remote work day' })
  async createLog(
    @Request() req: any,
    @Body() createDto: CreateRemoteWorkLogDto,
  ) {
    const user = req.user;
    const isManager = user.role === UserRole.ADMIN || user.role === UserRole.HR;

    let targetEmployeeId: string;
    let targetUserId: string;

    if (createDto.employeeId) {
      if (!isManager) {
        throw new ForbiddenException('Only Admin or HR can log remote work for another employee');
      }
      const employee = await this.employeesService.findOne(createDto.employeeId);
      targetEmployeeId = employee.id;
      targetUserId = employee.userId;
    } else {
      const employee = await this.employeesService.findByUserId(user.id);
      targetEmployeeId = employee.id;
      targetUserId = user.id;
    }

    const { employeeId: _employeeId, ...payload } = createDto;
    return this.remoteWorkService.create(targetUserId, targetEmployeeId, payload);
  }

  @Get('logs')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get remote work logs with filters' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.remoteWorkService.findAll({
      employeeId,
      startDate,
      endDate,
    });
  }

  @Get('logs/my')
  @ApiOperation({ summary: 'Get remote work logs for current user' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async findMine(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const user = req.user;
    await this.employeesService.findByUserId(user.id);
    return this.remoteWorkService.findForUser(user.id, { startDate, endDate });
  }

  @Get('policy')
  @ApiOperation({ summary: 'Get the remote work policy' })
  getPolicy() {
    return this.remoteWorkService.getPolicy();
  }

  @Patch('policy')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update the remote work policy' })
  updatePolicy(@Body() updateDto: UpdateRemoteWorkPolicyDto) {
    return this.remoteWorkService.updatePolicy(updateDto);
  }

  @Get('window')
  @ApiOperation({ summary: 'Get the current remote work window state' })
  getWindowState() {
    return this.remoteWorkService.getWindowState();
  }

  @Patch('window/open')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Open a remote work submission window' })
  openWindow(@Body() openDto: OpenRemoteWindowDto) {
    return this.remoteWorkService.openWindow(openDto);
  }

  @Patch('window/close')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Close the remote work submission window' })
  closeWindow() {
    return this.remoteWorkService.closeWindow();
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Set remote work preferences for the active window' })
  async setPreferences(
    @Request() req: any,
    @Body() preferencesDto: SetRemotePreferencesDto,
  ) {
    const user = req.user;
    const employee = await this.employeesService.findByUserId(user.id);
    return this.remoteWorkService.setPreferences(user.id, employee.id, preferencesDto);
  }
}


