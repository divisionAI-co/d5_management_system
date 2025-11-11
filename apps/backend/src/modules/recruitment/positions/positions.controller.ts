import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OpenPositionsService } from './positions.service';
import { FilterPositionsDto } from './dto/filter-positions.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { ClosePositionDto } from './dto/close-position.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Recruitment - Positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recruitment/positions')
export class OpenPositionsController {
  constructor(private readonly positionsService: OpenPositionsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List open positions with optional filters and pagination',
  })
  findAll(@Query() filters: FilterPositionsDto) {
    return this.positionsService.findAll(filters);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Get details for a specific position' })
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Update position metadata' })
  update(@Param('id') id: string, @Body() updateDto: UpdatePositionDto) {
    return this.positionsService.update(id, updateDto);
  }

  @Get(':id/candidates')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List candidates linked to the specified position',
  })
  getCandidates(@Param('id') id: string) {
    return this.positionsService.getCandidates(id);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Mark a position as filled' })
  close(@Param('id') id: string, @Body() closeDto: ClosePositionDto) {
    return this.positionsService.close(id, closeDto);
  }
}


