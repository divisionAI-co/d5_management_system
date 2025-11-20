import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { salesPerformanceReportsApi } from '@/lib/api/crm/sales-performance-reports';
import type {
  SalesPerformanceReport,
  CreateSalesPerformanceReportDto,
  UpdateSalesPerformanceReportDto,
} from '@/types/sales-performance-reports';
import { format } from 'date-fns';

interface SalesPerformanceReportFormProps {
  report?: SalesPerformanceReport;
  onClose: () => void;
  onSuccess: () => void;
  onFeedback?: (message: string, tone: 'success' | 'error' | 'info' | 'warning') => void;
}

type FormValues = {
  weekEnding: string;
  linkedinConnectionRequests: number;
  linkedinAccepted: number;
  linkedinMeetingsScheduled: number;
  linkedinAccountsCount: number;
  linkedinMarketsTargeted: string;
  inmailSent: number;
  inmailReplies: number;
  inmailMeetingsScheduled: number;
};

export function SalesPerformanceReportForm({
  report,
  onClose,
  onSuccess,
  onFeedback,
}: SalesPerformanceReportFormProps) {
  const isEdit = !!report;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      weekEnding: report?.weekEnding
        ? format(new Date(report.weekEnding), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      linkedinConnectionRequests: report?.linkedinConnectionRequests || 0,
      linkedinAccepted: report?.linkedinAccepted || 0,
      linkedinMeetingsScheduled: report?.linkedinMeetingsScheduled || 0,
      linkedinAccountsCount: report?.linkedinAccountsCount || 0,
      linkedinMarketsTargeted: report?.linkedinMarketsTargeted || '',
      inmailSent: report?.inmailSent || 0,
      inmailReplies: report?.inmailReplies || 0,
      inmailMeetingsScheduled: report?.inmailMeetingsScheduled || 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSalesPerformanceReportDto) =>
      salesPerformanceReportsApi.create(data),
    onSuccess: () => {
      onFeedback?.('Report created successfully', 'success');
      onSuccess();
    },
    onError: (error: any) => {
      onFeedback?.(error.response?.data?.message || 'Failed to create report', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalesPerformanceReportDto }) =>
      salesPerformanceReportsApi.update(id, data),
    onSuccess: () => {
      onFeedback?.('Report updated successfully', 'success');
      onSuccess();
    },
    onError: (error: any) => {
      onFeedback?.(error.response?.data?.message || 'Failed to update report', 'error');
    },
  });

  const onSubmit = (data: FormValues) => {
    const payload: CreateSalesPerformanceReportDto | UpdateSalesPerformanceReportDto = {
      weekEnding: data.weekEnding,
      linkedinConnectionRequests: data.linkedinConnectionRequests,
      linkedinAccepted: data.linkedinAccepted,
      linkedinMeetingsScheduled: data.linkedinMeetingsScheduled,
      linkedinAccountsCount: data.linkedinAccountsCount,
      linkedinMarketsTargeted: data.linkedinMarketsTargeted || undefined,
      inmailSent: data.inmailSent,
      inmailReplies: data.inmailReplies,
      inmailMeetingsScheduled: data.inmailMeetingsScheduled,
    };

    if (isEdit) {
      updateMutation.mutate({ id: report.id, data: payload });
    } else {
      createMutation.mutate(payload as CreateSalesPerformanceReportDto);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Week Ending <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('weekEnding', { required: true })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.weekEnding && (
              <p className="text-sm text-red-500 mt-1">Week ending is required</p>
            )}
          </div>
        </div>
      </div>

      {/* LinkedIn Campaigns */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">LinkedIn Campaigns</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # of Connection Requests
            </label>
            <input
              type="number"
              {...register('linkedinConnectionRequests', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # of Accepted
            </label>
            <input
              type="number"
              {...register('linkedinAccepted', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # Meetings Scheduled
            </label>
            <input
              type="number"
              {...register('linkedinMeetingsScheduled', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # LinkedIn Accounts
            </label>
            <input
              type="number"
              {...register('linkedinAccountsCount', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">
              Markets Targeted
            </label>
            <input
              type="text"
              {...register('linkedinMarketsTargeted')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., USA, UK, Germany (comma-separated)"
            />
          </div>
        </div>
      </div>

      {/* InMail Campaigns */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">InMail Campaigns</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # InMails Sent
            </label>
            <input
              type="number"
              {...register('inmailSent', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # Replies
            </label>
            <input
              type="number"
              {...register('inmailReplies', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              # Meetings Scheduled
            </label>
            <input
              type="number"
              {...register('inmailMeetingsScheduled', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Saving...'
            : isEdit
              ? 'Update Report'
              : 'Create Report'}
        </button>
      </div>
    </form>
  );
}

