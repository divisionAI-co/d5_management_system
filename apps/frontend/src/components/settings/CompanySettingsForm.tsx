import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FeedbackToast } from '@/components/ui/feedback-toast';

import { settingsApi } from '@/lib/api/settings';
import type {
  CompanySettings,
  RemoteWorkFrequency,
  UpdateCompanySettingsPayload,
} from '@/types/settings';

type CompanySettingsFormValues = {
  remoteWorkFrequency: RemoteWorkFrequency;
  remoteWorkLimit: number;
  eodGraceDays: number;
  eodReportDeadlineHour: number;
  eodReportDeadlineMin: number;
  reviewCycleDays: number;
  annualLeaveAllowanceDays: number;
};

const DEFAULT_VALUES: CompanySettingsFormValues = {
  remoteWorkFrequency: 'WEEKLY',
  remoteWorkLimit: 1,
  eodGraceDays: 2,
  eodReportDeadlineHour: 23,
  eodReportDeadlineMin: 59,
  reviewCycleDays: 180,
  annualLeaveAllowanceDays: 20,
};

const FREQUENCY_OPTIONS: Array<{
  value: RemoteWorkFrequency;
  label: string;
}> = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export function CompanySettingsForm() {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['company-settings'],
    queryFn: settingsApi.getCompanySettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<CompanySettingsFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (data) {
      const initialValues: CompanySettingsFormValues = {
        remoteWorkFrequency: data.remoteWorkFrequency,
        remoteWorkLimit: data.remoteWorkLimit,
        eodGraceDays: data.eodGraceDays,
        eodReportDeadlineHour: data.eodReportDeadlineHour,
        eodReportDeadlineMin: data.eodReportDeadlineMin,
        reviewCycleDays: data.reviewCycleDays,
        annualLeaveAllowanceDays: data.annualLeaveAllowanceDays,
      };
      reset(initialValues);
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateCompanySettingsPayload) =>
      settingsApi.updateCompanySettings(payload),
    onSuccess: (updated: CompanySettings) => {
      queryClient.setQueryData(['company-settings'], updated);
    },
  });

  const onSubmit = (values: CompanySettingsFormValues) => {
    const payload: UpdateCompanySettingsPayload = {
      remoteWorkFrequency: values.remoteWorkFrequency,
      remoteWorkLimit: values.remoteWorkLimit,
      eodGraceDays: values.eodGraceDays,
      eodReportDeadlineHour: values.eodReportDeadlineHour,
      eodReportDeadlineMin: values.eodReportDeadlineMin,
      reviewCycleDays: values.reviewCycleDays,
      annualLeaveAllowanceDays: values.annualLeaveAllowanceDays,
    };

    mutation.mutate(payload);
  };

  const isSaving = mutation.isPending || isSubmitting;
  const handleReset = () => {
    if (data) {
      reset({
        remoteWorkFrequency: data.remoteWorkFrequency,
        remoteWorkLimit: data.remoteWorkLimit,
        eodGraceDays: data.eodGraceDays,
        eodReportDeadlineHour: data.eodReportDeadlineHour,
        eodReportDeadlineMin: data.eodReportDeadlineMin,
        reviewCycleDays: data.reviewCycleDays,
        annualLeaveAllowanceDays: data.annualLeaveAllowanceDays,
      });
      return;
    }
    reset(DEFAULT_VALUES);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Company Policies</h2>
        <p className="text-sm text-muted-foreground">
          Configure remote work limits, EOD submission rules, and review cycles.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
        <fieldset className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Remote Work Frequency
            </label>
            <select
              {...register('remoteWorkFrequency')}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Remote Days Allowed per Period
            </label>
            <input
              type="number"
              min={0}
              {...register('remoteWorkLimit', { valueAsNumber: true, min: 0 })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              EOD Grace Days Allowed
            </label>
            <input
              type="number"
              min={0}
              {...register('eodGraceDays', { valueAsNumber: true, min: 0 })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Performance Review Cycle (days)
            </label>
            <input
              type="number"
              min={30}
              {...register('reviewCycleDays', {
                valueAsNumber: true,
                min: 30,
              })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              EOD Deadline Hour (0-23)
            </label>
            <input
              type="number"
              min={0}
              max={23}
              {...register('eodReportDeadlineHour', {
                valueAsNumber: true,
                min: 0,
                max: 23,
              })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              EOD Deadline Minute (0-59)
            </label>
            <input
              type="number"
              min={0}
              max={59}
              {...register('eodReportDeadlineMin', {
                valueAsNumber: true,
                min: 0,
                max: 59,
              })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Annual PTO Allowance (days)
            </label>
            <input
              type="number"
              min={0}
              {...register('annualLeaveAllowanceDays', {
                valueAsNumber: true,
                min: 0,
              })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Determines how many paid days off each employee can use per calendar year.
            </p>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
          <button
            type="button"
          onClick={handleReset}
          disabled={!isDirty || isSaving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>

          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {mutation.isSuccess && (
          <FeedbackToast
            message="Settings updated successfully."
            onDismiss={() => mutation.reset()}
            tone="success"
          />
        )}
        {mutation.isError && (
          <FeedbackToast
            message="Unable to save changes. Please try again."
            onDismiss={() => mutation.reset()}
            tone="error"
          />
        )}
      </form>
    </div>
  );
}


