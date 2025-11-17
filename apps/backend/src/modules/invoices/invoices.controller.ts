import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { PreviewInvoiceDto } from './dto/preview-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'invoices',
  version: '1',
})
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Create a new invoice' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(userId, createInvoiceDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'List invoices with filtering and pagination' })
  findAll(@Query() filters: FilterInvoicesDto) {
    return this.invoicesService.findAll(filters);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNT_MANAGER,
    UserRole.SALESPERSON,
  )
  @ApiOperation({ summary: 'Get invoice details' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update invoice information' })
  update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete draft or overdue invoice' })
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Mark invoice as paid' })
  markPaid(
    @Param('id') id: string,
    @Body() markPaidDto: MarkInvoicePaidDto,
  ) {
    return this.invoicesService.markPaid(id, markPaidDto);
  }

  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Send invoice via email to customer' })
  sendInvoice(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() sendInvoiceDto: SendInvoiceDto,
  ) {
    return this.invoicesService.sendInvoice(
      id,
      userId,
      sendInvoiceDto,
    );
  }

  @Post(':id/preview')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Preview invoice HTML based on template' })
  previewInvoice(
    @Param('id') id: string,
    @Body() previewDto: PreviewInvoiceDto,
  ) {
    return this.invoicesService.previewInvoice(
      id,
      previewDto.templateId,
      previewDto.templateData,
    );
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Download invoice PDF' })
  async getInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.invoicesService.generateInvoicePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${id}.pdf"`,
    );
    res.send(pdf);
  }
}


