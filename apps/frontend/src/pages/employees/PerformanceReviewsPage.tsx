import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { performanceReviewsApi } from '@/lib/api/hr';
import { PerformanceReviewsList } from '@/components/hr/performance-reviews/PerformanceReviewsList';
import { PerformanceReviewForm } from '@/components/hr/performance-reviews/PerformanceReviewForm';
import { PerformanceReviewDetailsModal } from '@/components/hr/performance-reviews/PerformanceReviewDetailsModal';
import type { PerformanceReview } from '@/types/hr';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function PerformanceReviewsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { employeeId?: string; employeeName?: string } | null;
  const employeeIdFilter = state?.employeeId;
  const employeeName = state?.employeeName;
  const [showForm, setShowForm] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | undefined>();
  const [detailReview, setDetailReview] = useState<PerformanceReview | null>(null);
  const [deleteReview, setDeleteReview] = useState<PerformanceReview | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR';

  const deleteMutation = useMutation({
    mutationFn: (id: string) => performanceReviewsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      if (employeeIdFilter) {
        queryClient.invalidateQueries({ queryKey: ['performance-reviews', employeeIdFilter] });
      }
      setDeleteReview(null);
    },
  });

  const handleCreate = () => {
    if (!canManage) {
      return;
    }
    setSelectedReview(undefined);
    setShowForm(true);
  };

  const handleEdit = (review: PerformanceReview) => {
    if (!canManage) {
      return;
    }
    setSelectedReview(review);
    setShowForm(true);
  };

  const handleView = (review: PerformanceReview) => {
    setDetailReview(review);
  };

  const handleDownload = async (review: PerformanceReview) => {
    try {
      setDownloadingId(review.id);
      const blob = await performanceReviewsApi.downloadPdf(review.id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `performance-review-${review.employee?.user.lastName || 'employee'}-${review.id}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF', error);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {employeeIdFilter && (
        <div className="mb-4">
          <button
            onClick={() => navigate(`/employees/${employeeIdFilter}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Back to {employeeName || 'Employee'}
          </button>
        </div>
      )}
      <PerformanceReviewsList
        onCreateNew={canManage ? handleCreate : undefined}
        onEdit={canManage ? handleEdit : undefined}
        onView={handleView}
        onDelete={canManage ? setDeleteReview : undefined}
        onDownloadPdf={handleDownload}
        downloadingId={downloadingId}
        contextLabel={employeeName}
        filterEmployeeId={employeeIdFilter}
      />

      {showForm && canManage && (
        <PerformanceReviewForm
          review={selectedReview}
          employeeId={employeeIdFilter}
          onClose={() => {
            setShowForm(false);
            setSelectedReview(undefined);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
            if (employeeIdFilter) {
              queryClient.invalidateQueries({
                queryKey: ['performance-reviews', employeeIdFilter],
              });
            }
          }}
        />
      )}

      {detailReview && (
        <PerformanceReviewDetailsModal review={detailReview} onClose={() => setDetailReview(null)} />
      )}

      {deleteReview && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Performance Review</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete the review for{' '}
              <span className="font-semibold">
                {deleteReview.employee?.user.firstName} {deleteReview.employee?.user.lastName}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteReview(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteReview.id)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {downloadingId && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-lg">
          Preparing PDF download...
        </div>
      )}
    </div>
  );
}


