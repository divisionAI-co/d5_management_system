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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ConvertContactToLeadDto } from './dto/convert-contact-to-lead.dto';

@ApiTags('CRM - Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Create a new contact' })
  create(@Body() createContactDto: CreateContactDto) {
    return this.contactsService.create(createContactDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'List contacts with filtering and pagination' })
  findAll(@Query() filters: FilterContactsDto) {
    return this.contactsService.findAll(filters);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Get contact details' })
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Update contact details' })
  update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON)
  @ApiOperation({ summary: 'Delete a contact' })
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }

  @Post(':id/convert-to-lead')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ summary: 'Convert contact into a lead' })
  convertToLead(
    @Param('id') id: string,
    @Body() payload: ConvertContactToLeadDto,
  ) {
    return this.contactsService.convertToLead(id, payload);
  }
}
