import { PartialType } from '@nestjs/swagger';

import { CreateAiActionDto } from './create-ai-action.dto';

export class UpdateAiActionDto extends PartialType(CreateAiActionDto) {}


