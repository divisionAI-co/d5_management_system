import { apiClient } from './client';

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

export interface StoredFile {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: 'IMAGE' | 'DOCUMENT' | 'OTHER';
  url: string;
  path: string;
  blogId?: string | null;
  caseStudyId?: string | null;
  uploadedById?: string | null;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const multipartHeaders = { 'Content-Type': 'multipart/form-data' };

export const storageApi = {
  /**
   * Upload a file (generic storage service)
   * @param file - File to upload
   * @param options - Optional associations (blogId, caseStudyId)
   */
  async upload(file: File, options?: { blogId?: string; caseStudyId?: string }) {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.blogId) {
      formData.append('blogId', options.blogId);
    }
    if (options?.caseStudyId) {
      formData.append('caseStudyId', options.caseStudyId);
    }
    const { data } = await apiClient.post<UploadFileResult>('/storage/upload', formData, {
      headers: multipartHeaders,
    });
    return data;
  },

  /**
   * List stored files with optional filters
   */
  async list(filters?: {
    category?: 'IMAGE' | 'DOCUMENT' | 'OTHER';
    blogId?: string;
    caseStudyId?: string;
  }) {
    const { data } = await apiClient.get<StoredFile[]>('/storage/list', {
      params: filters,
    });
    return data;
  },

  /**
   * Delete a stored file
   */
  async delete(id: string) {
    const { data } = await apiClient.delete<{ message: string }>(`/storage/files/${id}`);
    return data;
  },

  /**
   * Get file URL (public access)
   * Note: This returns the URL, not the file content
   */
  getFileUrl(category: string, storedName: string): string {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    return `${API_URL}/storage/files/${category}/${storedName}`;
  },
};

