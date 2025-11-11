import type { PerformanceReview } from '@/types/hr';
import { format } from 'date-fns';
import { X } from 'lucide-react';

interface PerformanceReviewDetailsModalProps {
  review: PerformanceReview;
  onClose: () => void;
}

export function PerformanceReviewDetailsModal({
  review,
  onClose,
}: PerformanceReviewDetailsModalProps) {
  const ratings = review.ratings as Record<string, number>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Review Details</h2>
            <p className="text-sm text-gray-500">
              Performance review for {review.employee?.user.firstName}{' '}
              {review.employee?.user.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <span className="text-xs uppercase text-gray-500">Employee</span>
              <p className="text-sm font-medium text-gray-900">
                {review.employee?.user.firstName} {review.employee?.user.lastName}
              </p>
              <p className="text-sm text-gray-500">{review.employee?.jobTitle}</p>
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Reviewer</span>
              <p className="text-sm font-medium text-gray-900">
                {review.reviewerName || 'Not provided'}
              </p>
              {review.reviewedAt && (
                <p className="text-sm text-gray-500">
                  Reviewed {format(new Date(review.reviewedAt), 'MMM dd, yyyy')}
                </p>
              )}
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Review Period</span>
              <p className="text-sm font-medium text-gray-900">
                {format(new Date(review.reviewPeriodStart), 'MMM dd, yyyy')} -{' '}
                {format(new Date(review.reviewPeriodEnd), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-gray-500">Overall Rating</span>
              <p className="text-sm font-medium text-gray-900">
                {review.overallRating ? review.overallRating.toFixed(1) : '—'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Ratings</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {Object.entries(ratings || {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <p className="text-lg font-semibold text-blue-600">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Strengths</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
              {review.strengths || 'No strengths documented.'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Areas for Improvement</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
              {review.improvements || 'No improvement notes provided.'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Goals</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
              {review.goals || 'No goals set for this cycle.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


