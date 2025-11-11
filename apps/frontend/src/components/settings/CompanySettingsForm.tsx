import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
};

const DEFAULT_VALUES: CompanySettingsFormValues = {
  remoteWorkFrequency: 'WEEKLY',
  remoteWorkLimit: 1,
  eodGraceDays: 2,
  eodReportDeadlineHour: 23,
  eodReportDeadlineMin: 59,
  reviewCycleDays: 180,
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
      });
      return;
    }
    reset(DEFAULT_VALUES);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Company Policies</h2>
        <p className="text-sm text-gray-500">
          Configure remote work limits, EOD submission rules, and review cycles.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
        <fieldset className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Remote Work Frequency
            </label>
            <select
              {...register('remoteWorkFrequency')}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Remote Days Allowed per Period
            </label>
            <input
              type="number"
              min={0}
              {...register('remoteWorkLimit', { valueAsNumber: true, min: 0 })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              EOD Grace Days Allowed
            </label>
            <input
              type="number"
              min={0}
              {...register('eodGraceDays', { valueAsNumber: true, min: 0 })}
              disabled={isLoading || isFetching}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
          <button
            type="button"
          onClick={handleReset}
          disabled={!isDirty || isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="text-sm text-green-600">
            Settings updated successfully.
          </p>
        )}
        {mutation.isError && (
          <p className="text-sm text-red-600">
            Unable to save changes. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}


