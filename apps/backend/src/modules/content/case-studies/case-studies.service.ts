import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CaseStudyStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateCaseStudyDto } from './dto/create-case-study.dto';
import { UpdateCaseStudyDto } from './dto/update-case-study.dto';
import { FilterCaseStudiesDto } from './dto/filter-case-studies.dto';

/**
 * Converts Google Drive sharing links to proxy URLs in HTML content
 * Supports formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/file/d/FILE_ID/edit
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID
 */
function convertGoogleDriveUrls(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }

  const extractFileId = (url: string): string | null => {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      return fileIdMatch[1];
    }
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return idMatch[1];
    }
    return null;
  };

  // Match img src attributes with Google Drive URLs
  const googleDriveUrlPattern = /(<img)([^>]+src=)(["'])(https?:\/\/drive\.google\.com\/[^"']+)(\3)([^>]*>)/gi;
  
  return html.replace(googleDriveUrlPattern, (match, imgTag, srcPrefix, quote, url, quoteEnd, rest) => {
    const fileId = extractFileId(url);
    if (fileId) {
      const proxyUrl = `/api/v1/templates/proxy/google-drive-image?fileId=${fileId}`;
      return `${imgTag}${srcPrefix}${quote}${proxyUrl}${quoteEnd}${rest}`;
    }
    return match;
  });
}

/**
 * Converts a Google Drive URL to proxy URL (for featured images and logos)
 */
function convertGoogleDriveUrl(url: string): string {
  if (!url || typeof url !== 'string' || !url.includes('drive.google.com')) {
    return url;
  }

  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = fileIdMatch?.[1] || idMatch?.[1];

  if (fileId) {
    return `/api/v1/templates/proxy/google-drive-image?fileId=${fileId}`;
  }

  return url;
}

@Injectable()
export class CaseStudiesService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Generate a URL-friendly slug from a title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Ensure slug is unique by appending a number if needed
   */
  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.caseStudy.findUnique({
        where: { slug: uniqueSlug },
      });

      if (!existing || existing.id === excludeId) {
        break;
      }

      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  async create(createDto: CreateCaseStudyDto, authorId: string) {
    // Generate slug if not provided
    const slug = createDto.slug
      ? await this.ensureUniqueSlug(createDto.slug)
      : await this.ensureUniqueSlug(this.generateSlug(createDto.title));

    // Convert Google Drive URLs in content, featured image, and client logo
    const processedContent = createDto.content ? convertGoogleDriveUrls(createDto.content) : createDto.content;
    const processedFeaturedImage = createDto.featuredImage ? convertGoogleDriveUrl(createDto.featuredImage) : createDto.featuredImage;
    const processedClientLogo = createDto.clientLogo ? convertGoogleDriveUrl(createDto.clientLogo) : createDto.clientLogo;
    const processedChallenge = createDto.challenge ? convertGoogleDriveUrls(createDto.challenge) : createDto.challenge;
    const processedSolution = createDto.solution ? convertGoogleDriveUrls(createDto.solution) : createDto.solution;
    const processedAboutCustomer = createDto.aboutCustomer ? convertGoogleDriveUrls(createDto.aboutCustomer) : createDto.aboutCustomer;

    const caseStudyData: Prisma.CaseStudyUncheckedCreateInput = {
      title: createDto.title,
      slug,
      excerpt: createDto.excerpt,
      content: processedContent,
      featuredImage: processedFeaturedImage,
      status: createDto.status ?? CaseStudyStatus.DRAFT,
      publishedAt: createDto.publishedAt ? new Date(createDto.publishedAt) : null,
      challenge: processedChallenge,
      solution: processedSolution,
      aboutCustomer: processedAboutCustomer,
      clientName: createDto.clientName,
      clientLogo: processedClientLogo,
      industry: createDto.industry,
      projectDate: createDto.projectDate ? new Date(createDto.projectDate) : null,
      results: createDto.results ? (createDto.results as Prisma.InputJsonValue) : undefined,
      metaTitle: createDto.metaTitle,
      metaDescription: createDto.metaDescription,
      authorId,
    };

    // If status is PUBLISHED and publishedAt is not set, set it to now
    if (caseStudyData.status === CaseStudyStatus.PUBLISHED && !caseStudyData.publishedAt) {
      caseStudyData.publishedAt = new Date();
    }

    const caseStudy = await this.prisma.caseStudy.create({
      data: caseStudyData,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return caseStudy;
  }

  async findAll(filters: FilterCaseStudiesDto, userId?: string) {
    const {
      page = 1,
      pageSize = 25,
      search,
      status,
      industry,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.CaseStudyWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { excerpt: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { content: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { clientName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (industry) {
      where.industry = { contains: industry, mode: Prisma.QueryMode.insensitive };
    }

    const [data, total] = await Promise.all([
      this.prisma.caseStudy.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.caseStudy.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const caseStudy = await this.prisma.caseStudy.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!caseStudy) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Case study', id));
    }

    return caseStudy;
  }

  async findBySlug(slug: string, requirePublished: boolean = false) {
    const caseStudy = await this.prisma.caseStudy.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!caseStudy) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Case study', slug));
    }

    // For public endpoints, ensure the case study is published
    if (requirePublished && caseStudy.status !== CaseStudyStatus.PUBLISHED) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Case study', slug));
    }

    return caseStudy;
  }

  async update(id: string, updateDto: UpdateCaseStudyDto, userId: string) {
    const existing = await this.findOne(id);

    // Check if user is the author or has admin privileges
    // This will be enforced at the controller level with roles guard

    const updateData: Prisma.CaseStudyUncheckedUpdateInput = {};

    if (updateDto.title !== undefined) {
      updateData.title = updateDto.title;
    }

    if (updateDto.slug !== undefined) {
      updateData.slug = await this.ensureUniqueSlug(updateDto.slug, id);
    } else if (updateDto.title !== undefined) {
      // If title changed but slug didn't, regenerate slug
      updateData.slug = await this.ensureUniqueSlug(
        this.generateSlug(updateDto.title),
        id,
      );
    }

    if (updateDto.excerpt !== undefined) {
      updateData.excerpt = updateDto.excerpt;
    }

    if (updateDto.content !== undefined) {
      updateData.content = convertGoogleDriveUrls(updateDto.content);
    }

    if (updateDto.challenge !== undefined) {
      updateData.challenge = convertGoogleDriveUrls(updateDto.challenge);
    }

    if (updateDto.solution !== undefined) {
      updateData.solution = convertGoogleDriveUrls(updateDto.solution);
    }

    if (updateDto.aboutCustomer !== undefined) {
      updateData.aboutCustomer = convertGoogleDriveUrls(updateDto.aboutCustomer);
    }

    if (updateDto.featuredImage !== undefined) {
      updateData.featuredImage = convertGoogleDriveUrl(updateDto.featuredImage);
    }

    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;

      // If status changed to PUBLISHED and publishedAt is not set, set it to now
      if (updateDto.status === CaseStudyStatus.PUBLISHED && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    if (updateDto.publishedAt !== undefined) {
      updateData.publishedAt = updateDto.publishedAt ? new Date(updateDto.publishedAt) : null;
    }

    if (updateDto.clientName !== undefined) {
      updateData.clientName = updateDto.clientName;
    }

    if (updateDto.clientLogo !== undefined) {
      updateData.clientLogo = convertGoogleDriveUrl(updateDto.clientLogo);
    }

    if (updateDto.industry !== undefined) {
      updateData.industry = updateDto.industry;
    }

    if (updateDto.projectDate !== undefined) {
      updateData.projectDate = updateDto.projectDate ? new Date(updateDto.projectDate) : null;
    }

    if (updateDto.results !== undefined) {
      updateData.results = updateDto.results ? (updateDto.results as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    if (updateDto.metaTitle !== undefined) {
      updateData.metaTitle = updateDto.metaTitle;
    }

    if (updateDto.metaDescription !== undefined) {
      updateData.metaDescription = updateDto.metaDescription;
    }

    const caseStudy = await this.prisma.caseStudy.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return caseStudy;
  }

  async remove(id: string) {
    await this.findOne(id); // Verify it exists

    await this.prisma.caseStudy.delete({
      where: { id },
    });

    return { message: 'Case study deleted successfully' };
  }
}

