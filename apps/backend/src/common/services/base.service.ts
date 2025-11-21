import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

@Injectable()
export abstract class BaseService {
  protected readonly logger: Logger;
  
  constructor(protected readonly prisma: PrismaService) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Standard error handling wrapper for Prisma operations
   * Handles common Prisma errors and converts them to appropriate HTTP exceptions
   */
  protected async handlePrismaError<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Unique constraint violation
      if (error?.code === 'P2002') {
        const target = error?.meta?.target as string[] | undefined;
        const field = target?.[0] || 'record';
        throw new BadRequestException(
          `${errorMessage}: Record with this ${field} already exists`
        );
      }
      
      // Record not found
      if (error?.code === 'P2025') {
        throw new NotFoundException(`${errorMessage}: Record not found`);
      }
      
      // Foreign key constraint violation
      if (error?.code === 'P2003') {
        throw new BadRequestException(
          `${errorMessage}: Referenced record does not exist`
        );
      }
      
      this.logger.error(errorMessage, error);
      throw error;
    }
  }

  /**
   * Standard pagination helper
   * Provides consistent pagination structure across all services
   */
  protected async paginate<T>(
    model: any,
    where: Prisma.Enumerable<T>,
    options: {
      page: number;
      pageSize: number;
      orderBy?: any;
      include?: any;
      select?: any;
    }
  ): Promise<PaginatedResult<T>> {
    const { page, pageSize, orderBy, include, select } = options;
    const skip = (page - 1) * pageSize;

    const [total, data] = await this.prisma.$transaction([
      model.count({ where }),
      model.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include,
        select,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }
}

