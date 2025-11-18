import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '@/lib/api/templates';
import { Loader2, Save, Mail } from 'lucide-react';

type EmailActionType =
  | 'EOD_REPORT_SUBMITTED'
  | 'LEAVE_REQUEST_CREATED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'TASK_ASSIGNED'
  | 'MENTION_NOTIFICATION'
  | 'REMOTE_WORK_WINDOW_OPENED';

const EMAIL_ACTION_LABELS: Record<EmailActionType, string> = {
  EOD_REPORT_SUBMITTED: 'EOD Report Submitted',
  LEAVE_REQUEST_CREATED: 'Leave Request Created',
  LEAVE_REQUEST_APPROVED: 'Leave Request Approved',
  LEAVE_REQUEST_REJECTED: 'Leave Request Rejected',
  TASK_ASSIGNED: 'Task Assigned',
  MENTION_NOTIFICATION: 'Mention Notification',
  REMOTE_WORK_WINDOW_OPENED: 'Remote Work Window Opened',
};

export default function EmailTemplateConfigPage() {
  const queryClient = useQueryClient();
  const [configurations, setConfigurations] = useState<Record<string, string | null>>({});

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['email-template-config'],
    queryFn: () => templatesApi.getEmailConfig(),
    onSuccess: (data) => {
      setConfigurations(data);
    },
  });

  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['templates', 'email'],
    queryFn: () =>
      templatesApi.list({
        type: undefined, // Get all templates
        onlyActive: true,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ action, templateId }: { action: string; templateId: string | null }) =>
      templatesApi.setEmailTemplate(action, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-template-config'] });
    },
  });

  const handleChange = (action: EmailActionType, templateId: string | null) => {
    setConfigurations((prev) => ({
      ...prev,
      [action]: templateId,
    }));
  };

  const handleSave = async (action: EmailActionType) => {
    const templateId = configurations[action] || null;
    await updateMutation.mutateAsync({ action, templateId });
  };

  const getTemplatesForAction = (action: EmailActionType) => {
    if (!templates) return [];

    // Map action to template type
    const typeMap: Record<EmailActionType, string> = {
      EOD_REPORT_SUBMITTED: 'EOD_REPORT_SUBMITTED',
      LEAVE_REQUEST_CREATED: 'LEAVE_REQUEST_CREATED',
      LEAVE_REQUEST_APPROVED: 'LEAVE_REQUEST_APPROVED',
      LEAVE_REQUEST_REJECTED: 'LEAVE_REQUEST_REJECTED',
      TASK_ASSIGNED: 'TASK_ASSIGNED',
      MENTION_NOTIFICATION: 'MENTION_NOTIFICATION',
      REMOTE_WORK_WINDOW_OPENED: 'REMOTE_WORK_WINDOW_OPENED',
    };

    const targetType = typeMap[action];
    return templates.filter((t) => t.type === targetType);
  };

  if (isLoadingConfig || isLoadingTemplates) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Template Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Configure which email templates are used for system notifications and automated emails.
        </p>
      </div>

      <div className="space-y-6">
        {(Object.keys(EMAIL_ACTION_LABELS) as EmailActionType[]).map((action) => {
          const availableTemplates = getTemplatesForAction(action);
          const currentTemplateId = configurations[action] || null;
          const hasChanges = currentTemplateId !== (config?.[action] || null);
          const isSaving = updateMutation.isPending;

          return (
            <div
              key={action}
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">
                      {EMAIL_ACTION_LABELS[action]}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select the template to use when sending emails for this action.
                  </p>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      Email Template
                    </label>
                    <select
                      value={currentTemplateId || ''}
                      onChange={(e) =>
                        handleChange(action, e.target.value || null)
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Use Default Template</option>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                    {availableTemplates.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        No templates of type <code className="px-1 py-0.5 bg-muted rounded">{action}</code> found.
                        Create a template with this type first.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSave(action)}
                  disabled={!hasChanges || isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Note:</p>
        <p>
          If no template is selected, the system will use the default template for that action type.
          You can create and manage templates in the{' '}
          <a href="/settings/templates" className="underline font-medium">
            Templates
          </a>{' '}
          section.
        </p>
      </div>
    </div>
  );
}

