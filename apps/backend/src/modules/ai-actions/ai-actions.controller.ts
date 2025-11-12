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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiCollectionKey, AiEntityType } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiActionsService } from './ai-actions.service';
import { AiActionExecutor } from './ai-action-executor.service';
import {
  AttachAiActionDto,
  CreateAiActionDto,
  ExecuteAdhocAiActionDto,
  ExecuteAiActionDto,
  ListAiActionAttachmentsDto,
  ListAiActionExecutionsDto,
  UpdateAiActionDto,
} from './dto';
import { FieldMetadata } from './entity-field-resolver.service';
import { CollectionFieldMetadata, CollectionSummary } from './collection-field-resolver.service';

@ApiTags('AI Actions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/actions')
export class AiActionsController {
  constructor(
    private readonly aiActionsService: AiActionsService,
    private readonly aiActionExecutor: AiActionExecutor,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Gemini actions', description: 'Returns saved Gemini action templates.' })
  list(@Query('entityType') entityType?: AiEntityType, @Query('includeInactive') includeInactive?: string) {
    return this.aiActionsService.list({
      entityType,
      includeInactive: includeInactive === 'true',
    });
  }

  @Get('fields/:entityType')
  @ApiOperation({ summary: 'List available fields for an entity type' })
  listFields(@Param('entityType') entityType: AiEntityType): FieldMetadata[] {
    return this.aiActionsService.listEntityFields(entityType);
  }

  @Get('collections/:entityType')
  @ApiOperation({ summary: 'List available collections for an entity type' })
  listCollectionDefinitions(@Param('entityType') entityType: AiEntityType): CollectionSummary[] {
    return this.aiActionsService.listCollectionDefinitions(entityType);
  }

  @Get('collections/:entityType/:collectionKey/fields')
  @ApiOperation({ summary: 'List fields for a collection' })
  listCollectionFields(
    @Param('entityType') entityType: AiEntityType,
    @Param('collectionKey') collectionKey: AiCollectionKey,
  ): CollectionFieldMetadata[] {
    return this.aiActionsService.listCollectionFields(entityType, collectionKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Gemini action details' })
  get(@Param('id') id: string) {
    return this.aiActionsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Gemini action' })
  create(@Body() dto: CreateAiActionDto, @CurrentUser('id') userId: string) {
    return this.aiActionsService.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing Gemini action' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAiActionDto,
  ) {
    return this.aiActionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Gemini action' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.aiActionsService.remove(id, userId);
  }

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Attach a Gemini action to an entity instance' })
  attach(
    @Param('id') actionId: string,
    @Body() dto: AttachAiActionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.aiActionsService.attach(actionId, dto, userId);
  }

  @Delete('attachments/:attachmentId')
  @ApiOperation({ summary: 'Detach a Gemini action from an entity instance' })
  detach(@Param('attachmentId') attachmentId: string, @CurrentUser('id') userId: string) {
    return this.aiActionsService.detach(attachmentId, userId);
  }

  @Get('attachments')
  @ApiOperation({ summary: 'List Gemini action attachments for an entity' })
  listAttachments(@Query() query: ListAiActionAttachmentsDto) {
    return this.aiActionsService.listAttachments(query);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a saved Gemini action for an entity' })
  executeSaved(
    @Param('id') actionId: string,
    @Body() dto: ExecuteAiActionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.aiActionExecutor.executeSavedAction({
      actionId,
      entityId: dto.entityId,
      fieldKeysOverride: dto.fieldKeys,
      promptOverride: dto.promptOverride,
      extraInstructions: dto.extraInstructions,
      triggeredById: userId,
    });
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute an ad-hoc Gemini prompt for an entity' })
  executeAdhoc(@Body() dto: ExecuteAdhocAiActionDto, @CurrentUser('id') userId: string) {
    return this.aiActionExecutor.executeAdhoc({
      entityType: dto.entityType,
      entityId: dto.entityId,
      prompt: dto.prompt,
      fieldKeys: dto.fieldKeys,
      model: dto.model,
      triggeredById: userId,
      extraInstructions: dto.extraInstructions,
    });
  }

  @Get('executions')
  @ApiOperation({ summary: 'List Gemini action executions' })
  listExecutions(@Query() query: ListAiActionExecutionsDto) {
    return this.aiActionsService.listExecutions(query);
  }
}


