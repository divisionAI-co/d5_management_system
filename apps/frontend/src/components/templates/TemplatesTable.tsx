import { Eye, Pencil } from 'lucide-react';
import type { TemplateModel, TemplateType } from '@/types/templates';

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  INVOICE: 'Invoice',
  CUSTOMER_REPORT: 'Customer Report',
  PERFORMANCE_REVIEW: 'Performance Review',
  FEEDBACK_REPORT: 'Feedback Report',
  EMAIL: 'Email',
  EOD_REPORT_SUBMITTED: 'EOD Report Submitted',
  LEAVE_REQUEST_CREATED: 'Leave Request Created',
  LEAVE_REQUEST_APPROVED: 'Leave Request Approved',
  LEAVE_REQUEST_REJECTED: 'Leave Request Rejected',
  TASK_ASSIGNED: 'Task Assigned',
  MENTION_NOTIFICATION: 'Mention Notification',
  REMOTE_WORK_WINDOW_OPENED: 'Remote Work Window Opened',
  QUOTE: 'Quote',
};

interface TemplatesTableProps {
  templates: TemplateModel[];
  isLoading: boolean;
  onEdit: (template: TemplateModel) => void;
  onPreview: (template: TemplateModel) => void;
}

export function TemplatesTable({
  templates,
  isLoading,
  onEdit,
  onPreview,
}: TemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm">
        Loading templates...
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
        No templates found. Create your first template to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Default
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Updated
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {templates.map((template) => {
            const updatedOn = new Date(template.updatedAt).toLocaleString();

            return (
              <tr
                key={template.id}
                className="cursor-pointer hover:bg-muted focus-within:bg-muted"
                role="button"
                tabIndex={0}
                onClick={() => onPreview(template)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPreview(template);
                  }
                }}
              >
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                  <div className="space-y-1">
                    <div>{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {template.variables.length} variable
                      {template.variables.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {TEMPLATE_LABELS[template.type]}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {template.isDefault ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Default
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      No
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {template.isActive ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {updatedOn}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPreview(template);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(template);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition hover:bg-blue-700"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


