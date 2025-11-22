export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CaseStudyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  featured: boolean;
  status: BlogStatus;
  publishedAt?: string | null;
  authorId: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  metaTitle?: string | null;
  metaDescription?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  featuredImage?: string | null;
  featured: boolean;
  status: CaseStudyStatus;
  publishedAt?: string | null;
  authorId: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  challenge?: string | null;
  solution?: string | null;
  aboutCustomer?: string | null;
  clientName?: string | null;
  clientLogo?: string | null;
  industry?: string | null;
  projectDate?: string | null;
  results?: Record<string, any> | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogDto {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  featured?: boolean;
  status?: BlogStatus;
  publishedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateBlogDto extends Partial<CreateBlogDto> {}

export interface BlogFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BlogStatus;
  featured?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'publishedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCaseStudyDto {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  featured?: boolean;
  status?: CaseStudyStatus;
  publishedAt?: string;
  challenge?: string;
  solution?: string;
  aboutCustomer?: string;
  clientName?: string;
  clientLogo?: string;
  industry?: string;
  projectDate?: string;
  results?: Record<string, any>;
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateCaseStudyDto extends Partial<CreateCaseStudyDto> {}

export interface CaseStudyFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CaseStudyStatus;
  industry?: string;
  featured?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'publishedAt' | 'projectDate';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

