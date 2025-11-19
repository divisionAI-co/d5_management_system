import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DataCleanupService } from './data-cleanup.service';

@ApiTags('Admin - Data Cleanup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/data-cleanup')
export class DataCleanupController {
  constructor(private readonly dataCleanupService: DataCleanupService) {}

  @Get('counts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get counts of CRM data (contacts, leads, opportunities)',
    description: 'Returns the number of contacts, leads, and opportunities before cleanup',
  })
  @ApiResponse({
    status: 200,
    description: 'Data counts retrieved successfully',
  })
  async getCounts() {
    return this.dataCleanupService.getCrmDataCounts();
  }

  @Post('crm')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clean up CRM data (contacts, leads, opportunities)',
    description:
      '⚠️ WARNING: This will permanently delete all contacts, leads, and opportunities. ' +
      'This action cannot be undone. Use this before reimporting data.',
  })
  @ApiResponse({
    status: 200,
    description: 'CRM data cleaned up successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async cleanupCrmData() {
    return this.dataCleanupService.cleanupCrmData();
  }
}

