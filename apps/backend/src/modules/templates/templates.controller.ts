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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'templates', version: '1' })
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List available templates' })
  findAll(@Query() query: ListTemplatesDto) {
    return this.templatesService.findAll(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new template' })
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(createTemplateDto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get template details by ID' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a template' })
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Post(':id/preview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Render a template using sample data' })
  preview(@Param('id') id: string, @Body() previewTemplateDto: PreviewTemplateDto) {
    return this.templatesService.preview(id, previewTemplateDto);
  }

  @Post(':id/duplicate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Duplicate a template' })
  duplicate(@Param('id') id: string) {
    return this.templatesService.duplicate(id);
  }
}


