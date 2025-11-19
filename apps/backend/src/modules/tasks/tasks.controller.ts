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
import { UserRole } from '@prisma/client';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { LogTimeDto } from './dto/log-time.dto';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Task Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Get tasks in Kanban format' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit the number of tasks returned (max 200)',
  })
  findAll(@Query() filters: FilterTasksDto) {
    return this.tasksService.findAll(filters);
  }

  // ============================================
  // Task Templates (Recurring Tasks) Endpoints
  // Must come before @Get(':id') to avoid route conflicts
  // ============================================

  @Get('templates')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
  )
  @ApiOperation({ summary: 'Get all recurring task templates' })
  findAllTemplates() {
    return this.tasksService.findAllTemplates();
  }

  @Get('templates/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
  )
  @ApiOperation({ summary: 'Get a task template by ID' })
  findOneTemplate(@Param('id') id: string) {
    return this.tasksService.findOneTemplate(id);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Get a task by ID' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post(':id/add-to-eod')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Add task to current user EOD report' })
  addTaskToEodReport(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.tasksService.addTaskToEodReport(id, userId, role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.update(id, updateTaskDto, userId);
  }

  @Post(':id/log-time')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Log time spent on a task' })
  logTime(
    @Param('id') id: string,
    @Body() logTimeDto: LogTimeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.logTime(id, logTimeDto, userId);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
    UserRole.HR,
    UserRole.RECRUITER,
    UserRole.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Update task status' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  // Task Templates POST/PATCH/DELETE routes
  // GET routes are defined above, before @Get(':id')

  @Post('templates')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Create a recurring task template' })
  createTemplate(@Body() createTemplateDto: CreateTaskTemplateDto) {
    return this.tasksService.createTemplate(createTemplateDto);
  }

  @Patch('templates/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.HR, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Update a task template' })
  updateTemplate(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTaskTemplateDto,
  ) {
    return this.tasksService.updateTemplate(id, updateTemplateDto);
  }

  @Delete('templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a task template' })
  removeTemplate(@Param('id') id: string) {
    return this.tasksService.removeTemplate(id);
  }
}


