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
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('HR - Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new holiday' })
  create(@Body() createHolidayDto: CreateHolidayDto) {
    return this.holidaysService.create(createHolidayDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all holidays' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  findAll(@Query('year') year?: string) {
    const targetYear = year ? parseInt(year, 10) : undefined;
    return this.holidaysService.findAll(targetYear);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming holidays' })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  getUpcoming(@Query('daysAhead') daysAhead?: string) {
    const days = daysAhead ? parseInt(daysAhead, 10) : 30;
    return this.holidaysService.getUpcomingHolidays(days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get holiday by ID' })
  findOne(@Param('id') id: string) {
    return this.holidaysService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update holiday' })
  update(
    @Param('id') id: string,
    @Body() updateHolidayDto: UpdateHolidayDto,
  ) {
    return this.holidaysService.update(id, updateHolidayDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete holiday' })
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
