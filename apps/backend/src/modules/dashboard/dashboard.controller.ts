import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Version } from '@nestjs/common';
import { Cache } from '../../common/decorators/cache.decorator';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  @Version('1')
  @ApiOperation({ summary: 'Get current user dashboard overview' })
  @UseInterceptors(CacheInterceptor)
  @Cache(300, 'dashboard') // Cache for 5 minutes (300 seconds)
  getMyDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getMyDashboard(userId);
  }

  @Get('admin')
  @Version('1')
  @ApiOperation({ summary: 'Get admin dashboard with company-wide metrics' })
  @UseInterceptors(CacheInterceptor)
  @Cache(300, 'admin-dashboard') // Cache for 5 minutes
  getAdminDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getAdminDashboard();
  }
}


