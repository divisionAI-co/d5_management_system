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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CheckInOutsService } from './check-in-outs.service';
import { CreateCheckInOutDto } from './dto/create-check-in-out.dto';
import { UpdateCheckInOutDto } from './dto/update-check-in-out.dto';
import { FilterCheckInOutsDto } from './dto/filter-check-in-outs.dto';

@ApiTags('HR - Check-In/Check-Out')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/check-in-outs')
export class CheckInOutsController {
  constructor(private readonly checkInOutsService: CheckInOutsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new check-in/check-out record' })
  async create(@Request() req: any, @Body() createDto: CreateCheckInOutDto) {
    return this.checkInOutsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all check-in/check-out records (paginated)' })
  async findAll(@Request() req: any, @Query() filters: FilterCheckInOutsDto) {
    const user = req.user;
    const canManageOthers = user.role === UserRole.ADMIN || user.role === UserRole.HR;
    return this.checkInOutsService.findAll(filters, user.id, canManageOthers);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user check-in/check-out records (paginated)' })
  async findMine(@Request() req: any, @Query() filters: FilterCheckInOutsDto) {
    const user = req.user;
    return this.checkInOutsService.findAll(filters, user.id, false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get check-in/check-out record by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    const canManageOthers = user.role === UserRole.ADMIN || user.role === UserRole.HR;
    return this.checkInOutsService.findOne(id, user.id, canManageOthers);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update a check-in/check-out record' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateCheckInOutDto,
  ) {
    const user = req.user;
    const canManageOthers = user.role === UserRole.ADMIN || user.role === UserRole.HR;
    return this.checkInOutsService.update(id, updateDto, user.id, canManageOthers);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete a check-in/check-out record' })
  async remove(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    const canManageOthers = user.role === UserRole.ADMIN || user.role === UserRole.HR;
    return this.checkInOutsService.remove(id, user.id, canManageOthers);
  }
}

