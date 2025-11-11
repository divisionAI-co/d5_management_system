import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceReviewsApi } from '@/lib/api/hr';
import type { PerformanceReview } from '@/types/hr';
import { format } from 'date-fns';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
} from 'lucide-react';

interface PerformanceReviewsListProps {
  onCreateNew?: () => void;
  onEdit: (review: PerformanceReview) => void;
  onView: (review: PerformanceReview) => void;
  onDelete: (review: PerformanceReview) => void;
  onDownloadPdf: (review: PerformanceReview) => void;
  downloadingId?: string | null;
  contextLabel?: string;
  filterEmployeeId?: string;
}

export function PerformanceReviewsList({
  onCreateNew,
  onEdit,
  onView,
  onDelete,
  onDownloadPdf,
  downloadingId,
  contextLabel,
  filterEmployeeId,
}: PerformanceReviewsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['performance-reviews', filterEmployeeId],
    queryFn: () =>
      performanceReviewsApi.getAll(
        filterEmployeeId ? { employeeId: filterEmployeeId } : undefined,
      ),
  });

  const filtered = reviews?.filter((review) => {
    const employeeName = `${review.employee?.user.firstName || ''} ${
      review.employee?.user.lastName || ''
    }`.toLowerCase();
    const reviewer = (review.reviewerName || '').toLowerCase();
    const strengths = (review.strengths || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    return employeeName.includes(term) || reviewer.includes(term) || strengths.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Performance Reviews</h1>
            <p className="text-sm text-muted-foreground">
              {contextLabel
                ? `Viewing reviews for ${contextLabel}`
                : 'Track and manage employee reviews'}
            </p>
          </div>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New Review
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by employee, reviewer, or strengths..."
            className="w-full rounded-lg border border-border py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            type="text"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Review Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reviewer
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Overall
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Highlights
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered?.map((review) => (
                <tr key={review.id} className="transition hover:bg-muted">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-foreground">
                      {review.employee?.user.firstName} {review.employee?.user.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">{review.employee?.jobTitle}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    <div>
                      {format(new Date(review.reviewPeriodStart), 'MMM dd, yyyy')} -{' '}
                      {format(new Date(review.reviewPeriodEnd), 'MMM dd, yyyy')}
                    </div>
                    {review.reviewedAt && (
                      <div className="text-xs text-muted-foreground">
                        Reviewed on {format(new Date(review.reviewedAt), 'MMM dd, yyyy')}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {review.reviewerName || '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                    <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                      {review.overallRating !== undefined && review.overallRating !== null
                        ? (() => {
                            const overall = Number(review.overallRating);
                            return Number.isNaN(overall) ? '—' : overall.toFixed(1);
                          })()
                        : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    <p className="line-clamp-2">{review.strengths || 'No strengths recorded.'}</p>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onDownloadPdf(review)}
                        disabled={downloadingId === review.id}
                        className="rounded-lg p-2 text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                        title="Download PDF"
                      >
                        <Download
                          className={`h-4 w-4 ${downloadingId === review.id ? 'animate-pulse opacity-60' : ''}`}
                        />
                      </button>
                      <button
                        onClick={() => onView(review)}
                        className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEdit(review)}
                        className="rounded-lg p-2 text-green-600 transition hover:bg-green-50 hover:text-green-700"
                        title="Edit review"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(review)}
                        className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                        title="Delete review"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-border" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No reviews yet</h3>
          <p className="mt-2 text-muted-foreground">Create your first performance review to get started.</p>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              New Review
            </button>
          )}
        </div>
      )}
    </div>
  );
}


