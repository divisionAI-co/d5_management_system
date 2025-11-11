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
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { FilterCandidatesDto } from './dto/filter-candidates.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { LinkCandidatePositionDto } from './dto/link-position.dto';
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

  @Get(':id/positions')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List positions linked to a candidate',
  })
  getCandidatePositions(@Param('id') id: string) {
    return this.candidatesService.getPositions(id);
  }
}


