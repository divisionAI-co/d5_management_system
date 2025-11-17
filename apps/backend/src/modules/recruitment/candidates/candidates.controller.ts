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
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { FilterCandidatesDto } from './dto/filter-candidates.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { LinkCandidatePositionDto } from './dto/link-position.dto';
import { ConvertCandidateToEmployeeDto } from './dto/convert-candidate-to-employee.dto';
import { MarkInactiveDto } from './dto/mark-inactive.dto';
import { SendCandidateEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Recruitment - Candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recruitment/candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Create a new candidate profile' })
  create(@Body() createDto: CreateCandidateDto) {
    return this.candidatesService.create(createDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List candidates with optional filters and pagination',
  })
  findAll(@Query() filters: FilterCandidatesDto) {
    return this.candidatesService.findAll(filters);
  }

  @Get('recruiters')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List recruiters available for candidate assignment',
  })
  listRecruiters() {
    return this.candidatesService.listRecruiters();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Get candidate details' })
  findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Update a candidate profile' })
  update(@Param('id') id: string, @Body() updateDto: UpdateCandidateDto) {
    return this.candidatesService.update(id, updateDto);
  }

  @Patch(':id/stage')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Move candidate to the next recruitment stage' })
  updateStage(
    @Param('id') id: string,
    @Body() updateDto: UpdateCandidateStageDto,
  ) {
    return this.candidatesService.updateStage(id, updateDto);
  }

  @Post(':id/link-position')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Link a candidate to an open position or update the link status',
  })
  linkToPosition(
    @Param('id') id: string,
    @Body() linkDto: LinkCandidatePositionDto,
  ) {
    return this.candidatesService.linkToPosition(id, linkDto);
  }

  @Delete(':id/positions/:positionId')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Remove a position link from a candidate',
  })
  unlinkPosition(@Param('id') id: string, @Param('positionId') positionId: string) {
    return this.candidatesService.unlinkPosition(id, positionId);
  }

  @Post(':id/convert-to-employee')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Convert a candidate into an employee profile',
    description:
      'Creates an employee record from the candidate details. Optionally links an existing user or creates a new one.',
  })
  convertToEmployee(
    @Param('id') id: string,
    @Body() convertDto: ConvertCandidateToEmployeeDto,
  ) {
    return this.candidatesService.convertToEmployee(id, convertDto);
  }

  @Get(':id/positions')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List positions linked to a candidate',
  })
  getCandidatePositions(@Param('id') id: string) {
    return this.candidatesService.getPositions(id);
  }

  @Patch(':id/archive')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Archive a candidate (soft delete)',
    description: 'Archives a candidate by setting deletedAt. Archived candidates are excluded from normal queries.',
  })
  archive(@Param('id') id: string) {
    return this.candidatesService.archive(id);
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Restore an archived candidate',
    description: 'Restores an archived candidate by clearing deletedAt.',
  })
  restore(@Param('id') id: string) {
    return this.candidatesService.restore(id);
  }

  @Patch(':id/mark-inactive')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Mark a candidate as inactive',
    description:
      'Marks a candidate as inactive with an optional reason and sends an optional email notification.',
  })
  markInactive(@Param('id') id: string, @Body() dto: MarkInactiveDto) {
    return this.candidatesService.markInactive(id, dto);
  }

  @Post(':id/send-email')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Send an email to a candidate',
    description:
      'Send an email using a template or custom content. Either templateId or htmlContent must be provided.',
  })
  sendEmail(@Param('id') id: string, @Body() dto: SendCandidateEmailDto) {
    return this.candidatesService.sendEmail(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Permanently delete a candidate',
    description: 'Permanently deletes a candidate. Cannot delete candidates linked to employees.',
  })
  delete(@Param('id') id: string) {
    return this.candidatesService.delete(id);
  }
}


