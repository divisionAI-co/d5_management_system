import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { EmailTemplateConfigService, EmailActionType } from './email-template-config.service';

class SetEmailTemplateDto {
  action!: EmailActionType;
  templateId!: string | null;
}

@ApiTags('Templates - Email Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates/email-config')
export class EmailTemplateConfigController {
  constructor(private readonly emailTemplateConfig: EmailTemplateConfigService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all email template configurations' })
  async getAllConfigurations() {
    return this.emailTemplateConfig.getAllConfigurations();
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Set email template for a specific action' })
  async setTemplate(@Body() dto: SetEmailTemplateDto) {
    await this.emailTemplateConfig.setTemplateForAction(dto.action, dto.templateId);
    return { success: true, message: 'Template configuration updated' };
  }
}

