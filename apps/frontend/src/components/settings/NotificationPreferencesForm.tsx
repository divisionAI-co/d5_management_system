import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/lib/api/settings';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import type {
  NotificationSettings,
  UpdateNotificationSettingsPayload,
} from '@/types/settings';

type NotificationFormValues = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  taskAssigned: boolean;
  taskDueSoon: boolean;
  leaveApproved: boolean;
  performanceReview: boolean;
  newCandidate: boolean;
  newOpportunity: boolean;
};

const DEFAULT_VALUES: NotificationFormValues = {
  emailEnabled: true,
  inAppEnabled: true,
  taskAssigned: true,
  taskDueSoon: true,
  leaveApproved: true,
  performanceReview: true,
  newCandidate: true,
  newOpportunity: true,
};

const mapToFormValues = (
  source?: NotificationSettings,
): NotificationFormValues => {
  if (!source) {
    return DEFAULT_VALUES;
  }

  return {
    emailEnabled: source.emailEnabled,
    inAppEnabled: source.inAppEnabled,
    taskAssigned: source.taskAssigned,
    taskDueSoon: source.taskDueSoon,
    leaveApproved: source.leaveApproved,
    performanceReview: source.performanceReview,
    newCandidate: source.newCandidate,
    newOpportunity: source.newOpportunity,
  };
};

const NOTIFICATION_GROUPS: Array<{
  key: keyof NotificationFormValues;
  title: string;
  description: string;
}> = [
  {
    key: 'emailEnabled',
    title: 'Email notifications',
    description: 'Receive updates via email for critical events.',
  },
  {
    key: 'inAppEnabled',
    title: 'In-app notifications',
    description: 'Show alerts inside the application notification center.',
  },
  {
    key: 'taskAssigned',
    title: 'Task assignments',
    description: 'Notify when new tasks are assigned to you.',
  },
  {
    key: 'taskDueSoon',
    title: 'Task due reminders',
    description: 'Send reminders one day before task deadlines.',
  },
  {
    key: 'leaveApproved',
    title: 'Leave requests',
    description: 'Inform about approvals or rejections of leave requests.',
  },
  {
    key: 'performanceReview',
    title: 'Performance reviews',
    description: 'Alert when a performance review is created or assigned.',
  },
  {
    key: 'newCandidate',
    title: 'New candidate added',
    description: 'Notify recruiters when new candidates enter the pipeline.',
  },
  {
    key: 'newOpportunity',
    title: 'New opportunity created',
    description: 'Notify sales and account managers of new opportunities.',
  },
];

export function NotificationPreferencesForm() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: settingsApi.getNotificationSettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<NotificationFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    reset(mapToFormValues(data));
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateNotificationSettingsPayload) =>
      settingsApi.updateNotificationSettings(payload),
    onSuccess: (updated: NotificationSettings) => {
      queryClient.setQueryData(['notification-settings'], updated);
    },
  });

  const onSubmit = (values: NotificationFormValues) => {
    const payload: UpdateNotificationSettingsPayload = { ...values };
    mutation.mutate(payload);
  };

  const isSaving = mutation.isPending || isSubmitting;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          Notification Preferences
        </h2>
        <p className="text-sm text-muted-foreground">
          Control how you receive updates across the platform.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
        <div className="space-y-4">
          {NOTIFICATION_GROUPS.map((setting) => (
            <label
              key={setting.key}
              className="flex w-full items-start justify-between gap-4 rounded-lg border border-border px-4 py-3 transition hover:bg-muted"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {setting.title}
                </p>
                <p className="text-xs text-muted-foreground">{setting.description}</p>
              </div>

              <input
                type="checkbox"
                {...register(setting.key)}
                disabled={isLoading || isSaving}
                className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => reset(mapToFormValues(data))}
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
            message="Preferences updated successfully."
            onDismiss={() => mutation.reset()}
            tone="success"
          />
        )}
        {mutation.isError && (
          <FeedbackToast
            message="Something went wrong. Please try again."
            onDismiss={() => mutation.reset()}
            tone="error"
          />
        )}
      </form>
    </div>
  );
}


