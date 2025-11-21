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
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { FilterQuotesDto } from './dto/filter-quotes.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { PreviewQuoteEmailDto } from './dto/preview-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('CRM - Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm/quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Create a new quote for a lead' })
  create(@Body() createQuoteDto: CreateQuoteDto) {
    return this.quotesService.create(createQuoteDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'List quotes with filtering and pagination' })
  findAll(@Query() filters: FilterQuotesDto) {
    return this.quotesService.findAll(filters);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get quote details' })
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update quote details' })
  update(@Param('id') id: string, @Body() updateQuoteDto: UpdateQuoteDto) {
    return this.quotesService.update(id, updateQuoteDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Delete a quote' })
  remove(@Param('id') id: string) {
    return this.quotesService.remove(id);
  }

  @Get(':id/preview')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Preview quote as HTML' })
  async preview(@Param('id') id: string) {
    return this.quotesService.preview(id);
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Generate PDF for quote' })
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.quotesService.generatePdf(id);
    const quote = await this.quotesService.findOne(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quote-${quote.quoteNumber}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Send quote to customer via email' })
  async send(
    @Param('id') id: string,
    @Body() sendQuoteDto: SendQuoteDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.quotesService.send(id, sendQuoteDto, userId);
  }

  @Post(':id/preview-email')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary: 'Preview an email for a quote',
    description:
      'Preview how an email will look using a template or custom content. Returns rendered HTML and text.',
  })
  previewEmail(@Param('id') id: string, @Body() dto: PreviewQuoteEmailDto) {
    return this.quotesService.previewEmail(id, dto);
  }

  @Get(':id/activities')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get activities for a quote' })
  async getActivities(@Param('id') id: string) {
    return this.quotesService.getActivities(id);
  }
}

