import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { caseStudiesApi } from '@/lib/api/content';
import type { CaseStudy, CaseStudyFilters, CaseStudyStatus } from '@/types/content';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { CreateCaseStudyModal } from '@/components/content/CreateCaseStudyModal';

const STATUS_OPTIONS: Array<{ value: CaseStudyStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function CaseStudiesPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CaseStudyFilters>({
    page: 1,
    pageSize: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCaseStudy, setEditingCaseStudy] = useState<CaseStudy | null>(null);
  const [deleteConfirmCaseStudy, setDeleteConfirmCaseStudy] = useState<CaseStudy | null>(null);

  const caseStudiesQuery = useQuery({
    queryKey: ['case-studies', filters],
    queryFn: () => caseStudiesApi.list(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => caseStudiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-studies'] });
      setFeedback('Case study deleted successfully.');
      setDeleteConfirmCaseStudy(null);
    },
  });

  const handleCreate = () => {
    setEditingCaseStudy(null);
    setIsCreateModalOpen(true);
  };

  const handleEdit = (caseStudy: CaseStudy) => {
    setEditingCaseStudy(caseStudy);
    setIsCreateModalOpen(true);
  };

  const handleDelete = (caseStudy: CaseStudy) => {
    setDeleteConfirmCaseStudy(caseStudy);
  };

  const confirmDelete = () => {
    if (deleteConfirmCaseStudy) {
      deleteMutation.mutate(deleteConfirmCaseStudy.id);
    }
  };

  const caseStudies = caseStudiesQuery.data?.data ?? [];
  const pagination = caseStudiesQuery.data?.pagination;

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Case Studies</h1>
          <p className="text-muted-foreground mt-1">Manage your case studies</p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Create Case Study
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search case studies..."
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
              status: e.target.value === 'ALL' ? undefined : (e.target.value as CaseStudyStatus),
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

      {caseStudiesQuery.isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : caseStudies.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No case studies found. Create your first case study!
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Author</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Published</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {caseStudies.map((caseStudy) => (
                  <tr key={caseStudy.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{caseStudy.title}</td>
                    <td className="px-4 py-3">{caseStudy.clientName || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          caseStudy.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : caseStudy.status === 'DRAFT'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {caseStudy.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {caseStudy.author.firstName} {caseStudy.author.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {caseStudy.publishedAt
                        ? new Date(caseStudy.publishedAt).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(caseStudy.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/content/case-studies/${caseStudy.id}`}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-blue-600 hover:bg-muted hover:text-blue-700"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                        <button
                          onClick={() => handleEdit(caseStudy)}
                          className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(caseStudy)}
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
                {pagination.total} case studies
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
        <CreateCaseStudyModal
          caseStudy={editingCaseStudy}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingCaseStudy(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['case-studies'] });
            setIsCreateModalOpen(false);
            setEditingCaseStudy(null);
            setFeedback(
              editingCaseStudy
                ? 'Case study updated successfully.'
                : 'Case study created successfully.',
            );
          }}
        />
      )}

      <ConfirmationDialog
        open={!!deleteConfirmCaseStudy}
        title="Delete Case Study"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold">{deleteConfirmCaseStudy?.title}</span>? This action
            cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmCaseStudy(null)}
      />

      {feedback && <FeedbackToast message={feedback} onDismiss={() => setFeedback(null)} />}
    </div>
  );
}

