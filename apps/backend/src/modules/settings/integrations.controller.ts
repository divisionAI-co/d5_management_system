import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

@ApiTags('Settings - Integrations')
@ApiBearerAuth()
@Controller('settings/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List available integrations' })
  list() {
    return this.integrationsService.listIntegrations();
  }

  @Patch(':name')
  @Roles(UserRole.ADMIN)
  @ApiParam({
    name: 'name',
    required: true,
    description: 'Integration identifier (e.g. google_drive)',
  })
  @ApiOperation({ summary: 'Update integration configuration' })
  update(
    @Param('name') name: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.updateIntegration(name, dto);
  }
}


