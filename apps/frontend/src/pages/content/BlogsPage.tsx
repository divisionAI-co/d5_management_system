import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { blogsApi } from '@/lib/api/content';
import type { Blog, BlogFilters, BlogStatus } from '@/types/content';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { CreateBlogModal } from '@/components/content/CreateBlogModal';

const STATUS_OPTIONS: Array<{ value: BlogStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function BlogsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<BlogFilters>({
    page: 1,
    pageSize: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [deleteConfirmBlog, setDeleteConfirmBlog] = useState<Blog | null>(null);

  const blogsQuery = useQuery({
    queryKey: ['blogs', filters],
    queryFn: () => blogsApi.list(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blogsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      setFeedback('Blog deleted successfully.');
      setDeleteConfirmBlog(null);
    },
  });

  const handleCreate = () => {
    setEditingBlog(null);
    setIsCreateModalOpen(true);
  };

  const handleEdit = (blog: Blog) => {
    setEditingBlog(blog);
    setIsCreateModalOpen(true);
  };

  const handleDelete = (blog: Blog) => {
    setDeleteConfirmBlog(blog);
  };

  const confirmDelete = () => {
    if (deleteConfirmBlog) {
      deleteMutation.mutate(deleteConfirmBlog.id);
    }
  };

  const blogs = blogsQuery.data?.data ?? [];
  const pagination = blogsQuery.data?.pagination;

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blogs</h1>
          <p className="text-muted-foreground mt-1">Manage your blog posts</p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Create Blog
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search blogs..."
          value={filters.search || ''}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
          }
          className="max-w-sm rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <select
          value={filters.status || 'ALL'}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              status: e.target.value === 'ALL' ? undefined : (e.target.value as BlogStatus),
              page: 1,
            }))
          }
          className="w-[180px] rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {blogsQuery.isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No blogs found. Create your first blog post!
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Author</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Published</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogs.map((blog) => (
                  <tr key={blog.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{blog.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          blog.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : blog.status === 'DRAFT'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {blog.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {blog.author.firstName} {blog.author.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {blog.publishedAt
                        ? new Date(blog.publishedAt).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(blog.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/content/blogs/${blog.id}`}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-blue-600 hover:bg-muted hover:text-blue-700"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                        <button
                          onClick={() => handleEdit(blog)}
                          className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(blog)}
                          className="rounded px-2 py-1 text-sm text-red-600 hover:bg-muted hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} blogs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="rounded-lg border border-border px-3 py-1 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-lg border border-border px-3 py-1 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isCreateModalOpen && (
        <CreateBlogModal
          blog={editingBlog}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingBlog(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['blogs'] });
            setIsCreateModalOpen(false);
            setEditingBlog(null);
            setFeedback(editingBlog ? 'Blog updated successfully.' : 'Blog created successfully.');
          }}
        />
      )}

      <ConfirmationDialog
        open={!!deleteConfirmBlog}
        title="Delete Blog"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold">{deleteConfirmBlog?.title}</span>? This action
            cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmBlog(null)}
      />

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
        />
      )}
    </div>
  );
}

