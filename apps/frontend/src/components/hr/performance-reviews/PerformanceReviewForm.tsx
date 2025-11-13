import { useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performanceReviewsApi, employeesApi } from '@/lib/api/hr';
import type {
  PerformanceReview,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
} from '@/types/hr';
import { X } from 'lucide-react';

interface PerformanceReviewFormProps {
  review?: PerformanceReview;
  onClose: () => void;
  onSuccess: () => void;
  employeeId?: string;
}

type FormValues = {
  employeeId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  communication: number;
  technical: number;
  leadership: number;
  strengths?: string;
  improvements?: string;
  goals?: string;
  overallRating?: number;
  reviewerName?: string;
  reviewedAt?: string;
};

export function PerformanceReviewForm({
  review,
  onClose,
  onSuccess,
  employeeId,
}: PerformanceReviewFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!review;

  const { data: employees } = useQuery({
    queryKey: ['employees', 'select'],
    queryFn: () => employeesApi.getAll(),
  });

  const defaultRatings = useMemo(() => {
    const ratings = review?.ratings as Record<string, number> | undefined;
    return {
      communication: ratings?.communication ?? 3,
      technical: ratings?.technical ?? 3,
      leadership: ratings?.leadership ?? 3,
    };
  }, [review]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: review
      ? {
          employeeId: review.employeeId,
          reviewPeriodStart: review.reviewPeriodStart.split('T')[0],
          reviewPeriodEnd: review.reviewPeriodEnd.split('T')[0],
          strengths: review.strengths || '',
          improvements: review.improvements || '',
          goals: review.goals || '',
          overallRating: review.overallRating || undefined,
          reviewerName: review.reviewerName || '',
          reviewedAt: review.reviewedAt ? review.reviewedAt.split('T')[0] : '',
          ...defaultRatings,
        }
      : {
          employeeId: employeeId ?? '',
          reviewPeriodStart: '',
          reviewPeriodEnd: '',
          strengths: '',
          improvements: '',
          goals: '',
          overallRating: undefined,
          reviewerName: '',
          reviewedAt: '',
          communication: 3,
          technical: 3,
          leadership: 3,
        },
  });

  useEffect(() => {
    if (employeeId && !isEdit) {
      setValue('employeeId', employeeId, { shouldValidate: true });
    }
  }, [employeeId, isEdit, setValue]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePerformanceReviewDto) => performanceReviewsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      onSuccess();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePerformanceReviewDto) =>
      performanceReviewsApi.update(review!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['performance-review', review!.id] });
      onSuccess();
      onClose();
    },
  });

  const onSubmit = (data: FormValues) => {
    const basePayload = {
      employeeId: data.employeeId,
      reviewPeriodStart: data.reviewPeriodStart,
      reviewPeriodEnd: data.reviewPeriodEnd,
      strengths: data.strengths || undefined,
      improvements: data.improvements || undefined,
      goals: data.goals || undefined,
      overallRating: data.overallRating ? Number(data.overallRating) : undefined,
      reviewedAt: data.reviewedAt || undefined,
      reviewerName: data.reviewerName || undefined,
      ratings: {
        communication: Number(data.communication),
        technical: Number(data.technical),
        leadership: Number(data.leadership),
      },
    };

    if (isEdit) {
      updateMutation.mutate(basePayload);
    } else {
      createMutation.mutate(basePayload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit Performance Review' : 'New Performance Review'}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit ? 'Update the review details.' : 'Complete the form to create a review.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!employeeId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Employee *</label>
                <select
                  {...register('employeeId', { required: 'Please select an employee' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an employee</option>
                  {employees?.data?.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.user?.firstName} {employee.user?.lastName} — {employee.jobTitle}
                    </option>
                  ))}
                </select>
                {errors.employeeId && (
                  <p className="mt-1 text-sm text-red-600">{errors.employeeId.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reviewer Name</label>
              <input
                type="text"
                {...register('reviewerName')}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Period Start *</label>
              <input
                type="date"
                {...register('reviewPeriodStart', { required: 'Start date is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.reviewPeriodStart && (
                <p className="mt-1 text-sm text-red-600">{errors.reviewPeriodStart.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Period End *</label>
              <input
                type="date"
                {...register('reviewPeriodEnd', { required: 'End date is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.reviewPeriodEnd && (
                <p className="mt-1 text-sm text-red-600">{errors.reviewPeriodEnd.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Overall Rating</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                {...register('overallRating', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Rating must be at least 0' },
                  max: { value: 5, message: 'Rating must be 5 or less' },
                })}
                placeholder="4.5"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.overallRating && (
                <p className="mt-1 text-sm text-red-600">{errors.overallRating.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reviewed At</label>
              <input
                type="date"
                {...register('reviewedAt')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Core Competencies (1-5)</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-600">
                  Communication
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  {...register('communication', { valueAsNumber: true, required: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-600">
                  Technical
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  {...register('technical', { valueAsNumber: true, required: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-600">
                  Leadership
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  {...register('leadership', { valueAsNumber: true, required: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Strengths</label>
              <textarea
                rows={4}
                {...register('strengths')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Key strengths demonstrated during the review period..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Areas for Improvement
              </label>
              <textarea
                rows={4}
                {...register('improvements')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Development opportunities and areas for growth..."
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Goals</label>
            <textarea
              rows={4}
              {...register('goals')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Objectives and goals for the next review cycle..."
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit
                ? 'Update Review'
                : 'Create Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


