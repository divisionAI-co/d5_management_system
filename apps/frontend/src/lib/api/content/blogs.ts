import apiClient from '@/lib/api/client';
import type {
  Blog,
  CreateBlogDto,
  UpdateBlogDto,
  BlogFilters,
  PaginatedResponse,
} from '@/types/content';

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
};

