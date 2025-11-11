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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Review Details</h2>
            <p className="text-sm text-muted-foreground">
              Performance review for {review.employee?.user.firstName}{' '}
              {review.employee?.user.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <span className="text-xs uppercase text-muted-foreground">Employee</span>
              <p className="text-sm font-medium text-foreground">
                {review.employee?.user.firstName} {review.employee?.user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{review.employee?.jobTitle}</p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Reviewer</span>
              <p className="text-sm font-medium text-foreground">
                {review.reviewerName || 'Not provided'}
              </p>
              {review.reviewedAt && (
                <p className="text-sm text-muted-foreground">
                  Reviewed {format(new Date(review.reviewedAt), 'MMM dd, yyyy')}
                </p>
              )}
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Review Period</span>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(review.reviewPeriodStart), 'MMM dd, yyyy')} -{' '}
                {format(new Date(review.reviewPeriodEnd), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Overall Rating</span>
              <p className="text-sm font-medium text-foreground">
                {review.overallRating ? review.overallRating.toFixed(1) : '—'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Ratings</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {Object.entries(ratings || {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border bg-muted p-3">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <p className="text-lg font-semibold text-blue-600">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Strengths</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {review.strengths || 'No strengths documented.'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Areas for Improvement</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {review.improvements || 'No improvement notes provided.'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Goals</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {review.goals || 'No goals set for this cycle.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


