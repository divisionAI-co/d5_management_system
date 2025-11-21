import { Injectable, NotFoundException } from '@nestjs/common';
import { Integration, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseService } from '../../common/services/base.service';
import { ErrorMessages } from '../../common/constants/error-messages.const';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

type IntegrationWithMetadata = Integration & {
  displayName: string;
  description?: string;
};

const DEFAULT_INTEGRATIONS: Array<{
  name: string;
  displayName: string;
  description?: string;
}> = [
  {
    name: 'google_drive',
    displayName: 'Google Drive',
    description: 'Enable read-only access to shared company folders.',
  },
  {
    name: 'google_calendar',
    displayName: 'Google Calendar',
    description: 'Synchronise meetings and availability with Google Calendar.',
  },
];

@Injectable()
export class IntegrationsService extends BaseService {
  private readonly defaultsLookup = new Map(
    DEFAULT_INTEGRATIONS.map((integration) => [integration.name, integration]),
  );

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private async ensureDefaults() {
    await Promise.all(
      DEFAULT_INTEGRATIONS.map((integration) =>
        this.prisma.integration.upsert({
          where: { name: integration.name },
          update: {},
          create: {
            name: integration.name,
            isActive: false,
          },
        }),
      ),
    );
  }

  private withMetadata(integration: Integration): IntegrationWithMetadata {
    const metadata = this.defaultsLookup.get(integration.name);

    return {
      ...integration,
      displayName: metadata?.displayName ?? integration.name,
      description: metadata?.description,
    };
  }

  async listIntegrations(): Promise<IntegrationWithMetadata[]> {
    await this.ensureDefaults();

    const integrations = await this.prisma.integration.findMany({
      orderBy: { name: 'asc' },
    });

    return integrations.map((integration) => this.withMetadata(integration));
  }

  private async getByName(name: string): Promise<Integration> {
    await this.ensureDefaults();

    const integration = await this.prisma.integration.findUnique({
      where: { name },
    });

    if (!integration) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('Integration', 'name', name));
    }

    return integration;
  }

  async updateIntegration(
    name: string,
    dto: UpdateIntegrationDto,
  ): Promise<IntegrationWithMetadata> {
    const integration = await this.getByName(name);

    const data: Prisma.IntegrationUpdateInput = {};

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (dto.config !== undefined) {
      data.config = dto.config as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data,
    });

    return this.withMetadata(updated);
  }
}


