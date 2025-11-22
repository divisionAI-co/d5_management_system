import apiClient from '@/lib/api/client';
import type {
  Blog,
  CreateBlogDto,
  UpdateBlogDto,
  BlogFilters,
  PaginatedResponse,
} from '@/types/content';

export interface UploadFileResult {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: 'IMAGE' | 'DOCUMENT' | 'OTHER';
  url: string;
  path: string;
}

const multipartHeaders = { 'Content-Type': 'multipart/form-data' };

export const blogsApi = {
  async list(filters?: BlogFilters) {
    const { data } = await apiClient.get<PaginatedResponse<Blog>>(
      '/content/blogs',
      {
        params: filters,
      },
    );
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<Blog>(`/content/blogs/${id}`);
    return data;
  },

  async getBySlug(slug: string) {
    const { data } = await apiClient.get<Blog>(`/content/blogs/public/${slug}`);
    return data;
  },

  async create(payload: CreateBlogDto) {
    const { data } = await apiClient.post<Blog>('/content/blogs', payload);
    return data;
  },

  async update(id: string, payload: UpdateBlogDto) {
    const { data } = await apiClient.patch<Blog>(`/content/blogs/${id}`, payload);
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<{ message: string }>(`/content/blogs/${id}`);
    return data;
  },

  async uploadImage(blogId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<UploadFileResult>(
      `/content/blogs/${blogId}/upload-image`,
      formData,
      {
        headers: multipartHeaders,
      },
    );
    return data;
  },
};

