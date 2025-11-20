import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

import type { CreateTemplatePayload, TemplateModel, TemplateType, TemplateVariable } from '@/types/templates';
import type { TemplateBlock } from '@/types/templates';
import { TemplateBlockEditor } from './TemplateBlockEditor';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import {
  createRawHtmlBlock,
  extractBlocksFromHtml,
  extractPageWidthFromHtml,
  getDefaultTemplateBlocks,
  injectBlockMetadata,
  parseHtmlToBlocks,
  renderBlocksToHtml,
} from './template-blocks';

type TemplateFormValues = {
  name: string;
  type: TemplateType;
  htmlContent: string;
  cssContent: string;
  isDefault: boolean;
  isActive: boolean;
};

type TemplateVariableForm = {
  id: string;
  key: string;
  description: string;
  sampleValue: string;
};

type TemplateFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  template?: TemplateModel;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTemplatePayload) => void;
};

const DEFAULT_HTML = `<main style="font-family: Arial, sans-serif; line-height: 1.5;">
  <h1 style="color: #1f2937;">Hi {{firstName}},</h1>
  <p>Thanks for choosing division5. This is your email template body.</p>
  <p style="margin-top: 24px;">— The division5 Team</p>
</main>`;

const TEMPLATE_TYPE_OPTIONS: Array<{ value: TemplateType; label: string; description: string }> = [
  {
    value: 'EMAIL',
    label: 'Email',
    description: 'Transactional or notification emails sent to users/customers.',
  },
  {
    value: 'INVOICE',
    label: 'Invoice',
    description: 'HTML template used when emailing invoices to customers.',
  },
  {
    value: 'CUSTOMER_REPORT',
    label: 'Customer Report',
    description: 'Summary reports sent to clients with engagement metrics.',
  },
  {
    value: 'PERFORMANCE_REVIEW',
    label: 'Performance Review',
    description: 'Documents for employee review exports or emails.',
  },
  {
    value: 'FEEDBACK_REPORT',
    label: 'Feedback Report',
    description: 'Templates for feedback report exports or emails.',
  },
  {
    value: 'EOD_REPORT_SUBMITTED',
    label: 'EOD Report Submitted',
    description: 'Email sent to employees when they submit their End of Day report.',
  },
  {
    value: 'LEAVE_REQUEST_CREATED',
    label: 'Leave Request Created',
    description: 'Email sent to HR when an employee creates a leave request.',
  },
  {
    value: 'LEAVE_REQUEST_APPROVED',
    label: 'Leave Request Approved',
    description: 'Email sent to employees when their leave request is approved.',
  },
  {
    value: 'LEAVE_REQUEST_REJECTED',
    label: 'Leave Request Rejected',
    description: 'Email sent to employees when their leave request is rejected.',
  },
  {
    value: 'TASK_ASSIGNED',
    label: 'Task Assigned',
    description: 'Email sent to users when a task is assigned to them.',
  },
  {
    value: 'MENTION_NOTIFICATION',
    label: 'Mention Notification',
    description: 'Email sent to users when they are mentioned in an activity.',
  },
  {
    value: 'REMOTE_WORK_WINDOW_OPENED',
    label: 'Remote Work Window Opened',
    description: 'Email sent to all users when a remote work window is opened.',
  },
  {
    value: 'QUOTE',
    label: 'Quote',
    description: 'HTML template used when generating quote PDFs or sending quote emails to customers.',
  },
];

const INPUT_BASE_CLASS =
  'w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500';

const INPUT_DENSE_CLASS =
  'w-full rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500';

const SELECT_BASE_CLASS =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer';

const TEXTAREA_MONO_CLASS =
  'w-full rounded-lg border border-border bg-muted/20 px-3 py-2 font-mono text-xs leading-5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500';

// const TOGGLE_BUTTON_BASE =
//   'rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

const DATA_CONTEXT_HELP: Record<
  TemplateType,
  {
    heading: string;
    description: string;
    groups?: Array<{ title: string; items: string[] }>;
    note?: string;
  }
> = {
  EMAIL: {
    heading: 'Email data context',
    description:
      'Email templates receive whatever payload is supplied when the message is sent. Use the Variables list below to declare the merge fields you expect, such as {{firstName}}.',
    note: 'System emails often pass recipient details (firstName, email) and CTA links. Check the sending module for exact fields.',
  },
  INVOICE: {
    heading: 'Invoice data context',
    description:
      'Invoices include the merged fields produced by buildInvoiceTemplateData. You can reference them directly or via the nested invoice object.',
    groups: [
      {
        title: 'Invoice',
        items: [
          '{{invoiceNumber}}',
          '{{issueDate}}',
          '{{dueDate}}',
          '{{status}}',
          '{{subtotal}}',
          '{{taxRate}}',
          '{{taxAmount}}',
          '{{total}}',
          '{{currency}}',
          '{{notes}}',
        ],
      },
      {
        title: 'Customer',
        items: ['{{customer.name}}', '{{customer.email}}', '{{invoice.customer.name}}', '{{invoice.customer.email}}'],
      },
      {
        title: 'Creator',
        items: ['{{createdBy.firstName}}', '{{createdBy.lastName}}', '{{createdBy.email}}'],
      },
      {
        title: 'Line items (loop over {{#each items}} ... {{/each}})',
        items: [
          '{{description}}',
          '{{quantity}}',
          '{{unitPrice}}',
          '{{lineTotal}}',
          '{{metadata.someField}}',
        ],
      },
    ],
    note: 'The entire invoice record is also available as {{invoice}} for advanced Handlebars logic.',
  },
  CUSTOMER_REPORT: {
    heading: 'Customer report context',
    description:
      'Customer reports are generated per module and pass summary metrics (totals, charts, timelines). Inspect the report generator to see the exact structure, then mirror it here with variables.',
  },
  PERFORMANCE_REVIEW: {
    heading: 'Performance review context',
    description:
      'Performance review exports include the review details (employee, period, overall rating, strengths, improvements). Match those keys with variables or reference nested objects like {{review.employee.firstName}}.',
  },
  FEEDBACK_REPORT: {
    heading: 'Feedback report context',
    description:
      'Feedback reports include report details, employee information, and feedback data. Reference fields like {{report.date}}, {{employee.firstName}}, and {{feedback.content}}. Use {{#if bankHolidays}}...{{/if}} and {{#each bankHolidays}}...{{/each}} to display arrays.',
    groups: [
      {
        title: 'Report & Employee',
        items: ['{{report.date}}', '{{employee.firstName}}', '{{employee.lastName}}', '{{feedback.content}}'],
      },
      {
        title: 'Bank Holidays (array) - Use {{#if bankHolidays}}...{{/if}} and {{#each bankHolidays}}...{{/each}}',
        items: ['{{this.name}}', '{{this.date}}'],
      },
    ],
  },
  EOD_REPORT_SUBMITTED: {
    heading: 'EOD Report data context',
    description:
      'EOD report emails include report details and task information. Available fields: {{report.date}}, {{report.summary}}, {{report.hoursWorked}}, {{report.isLate}}, {{report.tasks}} (array), {{user.firstName}}, {{user.lastName}}, {{user.email}}.',
    groups: [
      {
        title: 'Report',
        items: ['{{report.date}}', '{{report.summary}}', '{{report.hoursWorked}}', '{{report.isLate}}', '{{report.submittedAt}}'],
      },
      {
        title: 'User',
        items: ['{{user.firstName}}', '{{user.lastName}}', '{{user.email}}'],
      },
      {
        title: 'Tasks (loop with {{#each report.tasks}} ... {{/each}})',
        items: ['{{clientDetails}}', '{{ticket}}', '{{typeOfWorkDone}}', '{{timeSpent}}', '{{taskLifecycle}}', '{{taskStatus}}'],
      },
    ],
  },
  LEAVE_REQUEST_CREATED: {
    heading: 'Leave request data context',
    description:
      'Leave request emails include request details and employee information. Available fields: {{request.startDate}}, {{request.endDate}}, {{request.type}}, {{request.reason}}, {{employee.firstName}}, {{employee.lastName}}, {{employee.email}}.',
  },
  LEAVE_REQUEST_APPROVED: {
    heading: 'Leave request approval data context',
    description:
      'Leave approval emails include request details and employee information. Available fields: {{request.startDate}}, {{request.endDate}}, {{request.type}}, {{request.reason}}, {{employee.firstName}}, {{employee.lastName}}, {{approvedBy.firstName}}.',
  },
  LEAVE_REQUEST_REJECTED: {
    heading: 'Leave request rejection data context',
    description:
      'Leave rejection emails include request details and rejection reason. Available fields: {{request.startDate}}, {{request.endDate}}, {{request.type}}, {{request.reason}}, {{rejectionReason}}, {{employee.firstName}}, {{employee.lastName}}, {{rejectedBy.firstName}}.',
  },
  TASK_ASSIGNED: {
    heading: 'Task assignment data context',
    description:
      'Task assignment emails include task details and assignee information. Available fields: {{task.title}}, {{task.description}}, {{task.dueDate}}, {{task.priority}}, {{task.status}}, {{assignedTo.firstName}}, {{assignedTo.lastName}}, {{assignedBy.firstName}}.',
  },
  MENTION_NOTIFICATION: {
    heading: 'Mention notification data context',
    description:
      'Mention notification emails include activity details and entity information. Available fields: {{activity.content}}, {{activity.type}}, {{entityType}}, {{entityLink}}, {{mentionedBy.firstName}}, {{mentionedBy.lastName}}.',
    note: 'The {{entityLink}} field contains a URL to navigate to the entity where the mention occurred.',
  },
  REMOTE_WORK_WINDOW_OPENED: {
    heading: 'Remote work window data context',
    description:
      'Remote work window emails include window details. Available fields: {{window.startDate}}, {{window.endDate}}, {{window.limit}}, {{openedBy.firstName}}, {{openedBy.lastName}}.',
  },
  QUOTE: {
    heading: 'Quote data context',
    description:
      'Quote templates include quote details, lead information, and contact data. Available fields include quote number, title, description, overview, proposals, milestones, payment terms, and customer contact information.',
    groups: [
      {
        title: 'Quote Basic Info',
        items: [
          '{{quote.quoteNumber}}',
          '{{quote.title}}',
          '{{quote.description}}',
          '{{quote.status}}',
          '{{quote.totalValue}}',
          '{{quote.currency}}',
          '{{formatDate quote.createdAt}}',
        ],
      },
      {
        title: 'Quote Content (use {{{...}}} for HTML rendering)',
        items: [
          '{{{quote.overview}}}',
          '{{{quote.functionalProposal}}}',
          '{{{quote.technicalProposal}}}',
          '{{{quote.teamComposition}}}',
          '{{{quote.milestones}}}',
          '{{{quote.paymentTerms}}}',
          '{{quote.warrantyPeriod}}',
        ],
      },
      {
        title: 'Lead Information',
        items: [
          '{{quote.lead.title}}',
          '{{quote.lead.description}}',
          '{{quote.lead.prospectCompanyName}}',
          '{{quote.lead.prospectWebsite}}',
          '{{quote.lead.prospectIndustry}}',
        ],
      },
      {
        title: 'Contact Information',
        items: [
          '{{quote.contact.firstName}}',
          '{{quote.contact.lastName}}',
          '{{quote.contact.email}}',
          '{{quote.contact.phone}}',
          '{{quote.contact.companyName}}',
        ],
      },
    ],
    note: 'Use triple braces ({{{...}}}) to render HTML content for formatted fields like overview, proposals, milestones, etc.',
  },
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `var_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const newVariable = (): TemplateVariableForm => ({
  id: generateId(),
  key: '',
  description: '',
  sampleValue: '',
});

const toFormVariable = (variable: TemplateVariable): TemplateVariableForm => ({
  id: generateId(),
  key: variable.key ?? '',
  description: variable.description ?? '',
  sampleValue:
    variable.sampleValue === null || variable.sampleValue === undefined
      ? ''
      : typeof variable.sampleValue === 'string'
        ? variable.sampleValue
        : JSON.stringify(variable.sampleValue, null, 2),
});

export function TemplateFormModal({
  open,
  mode,
  template,
  submitting = false,
  onClose,
  onSubmit,
}: TemplateFormModalProps) {
  const [formValues, setFormValues] = useState<TemplateFormValues>(() => ({
    name: '',
    type: 'EMAIL',
    htmlContent: DEFAULT_HTML,
    cssContent: '',
    isDefault: false,
    isActive: true,
  }));

  const [variables, setVariables] = useState<TemplateVariableForm[]>(() => [newVariable()]);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(() => getDefaultTemplateBlocks());
  const [pageWidth, setPageWidth] = useState<number>(640);
  const [editingMode, setEditingMode] = useState<'visual' | 'html'>('visual');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (template) {
      const { blocks: storedBlocks, htmlWithoutMeta } = extractBlocksFromHtml(template.htmlContent);
      const extractedPageWidth = extractPageWidthFromHtml(template.htmlContent);

      setFormValues({
        name: template.name,
        type: template.type,
        htmlContent: htmlWithoutMeta,
        cssContent: template.cssContent ?? '',
        isDefault: template.isDefault,
        isActive: template.isActive,
      });

      const vars = template.variables?.length
        ? template.variables.map((item) => toFormVariable(item))
        : [newVariable()];
      setVariables(vars);
      setPageWidth(extractedPageWidth);

      if (storedBlocks && storedBlocks.length) {
        setBlocks(storedBlocks);
        setEditingMode('visual');
      } else {
        setBlocks([createRawHtmlBlock(htmlWithoutMeta)]);
        setEditingMode('html');
      }
    } else {
      const defaultBlocks = getDefaultTemplateBlocks();
      setFormValues({
        name: '',
        type: 'EMAIL',
        htmlContent: renderBlocksToHtml(defaultBlocks, 640),
        cssContent: '',
        isDefault: false,
        isActive: true,
      });
      setVariables([newVariable()]);
      setBlocks(defaultBlocks);
      setPageWidth(640);
      setEditingMode('visual');
    }
    setErrorMessage(null);
  }, [open, template]);

  useEffect(() => {
    if (editingMode !== 'visual') {
      return;
    }

    const generated = renderBlocksToHtml(blocks, pageWidth);
    // Always update to ensure page width changes are reflected
    setFormValues((prev) => ({
      ...prev,
      htmlContent: generated,
    }));
  }, [blocks, pageWidth, editingMode]);

  const dialogTitle = useMemo(
    () => (mode === 'create' ? 'Create Template' : `Edit ${template?.name ?? 'Template'}`),
    [mode, template?.name],
  );

  if (!open) {
    return null;
  }

  const handleVariableChange = (id: string, key: keyof TemplateVariableForm, value: string) => {
    setVariables((prev) =>
      prev.map((variable) => (variable.id === id ? { ...variable, [key]: value } : variable)),
    );
  };

  const handleRemoveVariable = (id: string) => {
    setVariables((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((variable) => variable.id !== id);
    });
  };

  const buildPayload = (): CreateTemplatePayload | null => {
    if (!formValues.name.trim()) {
      setErrorMessage('Template name is required.');
      return null;
    }

    if (!formValues.htmlContent.trim()) {
      setErrorMessage('HTML content cannot be empty.');
      return null;
    }

    const preparedVariables: TemplateVariable[] = [];

    for (const variable of variables) {
      if (!variable.key.trim()) {
        continue;
      }

      const entry: TemplateVariable = {
        key: variable.key.trim(),
      };

      if (variable.description.trim()) {
        entry.description = variable.description.trim();
      }

      if (variable.sampleValue.trim()) {
        const raw = variable.sampleValue.trim();

        try {
          entry.sampleValue = JSON.parse(raw);
        } catch {
          entry.sampleValue = raw;
        }
      }

      preparedVariables.push(entry);
    }

    if (!preparedVariables.length) {
      preparedVariables.push({ key: 'firstName', description: 'Recipient first name', sampleValue: 'Taylor' });
    }

    let htmlContent = formValues.htmlContent;

    if (editingMode === 'visual') {
      const htmlFromBlocks = renderBlocksToHtml(blocks, pageWidth);
      htmlContent = injectBlockMetadata(htmlFromBlocks, blocks);
    }

    return {
      name: formValues.name.trim(),
      type: formValues.type,
      htmlContent,
      cssContent: formValues.cssContent.trim() || undefined,
      variables: preparedVariables,
      isDefault: formValues.isDefault,
      isActive: formValues.isActive,
    };
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    onSubmit(payload);
  };

  return (
    <>
      {errorMessage && (
        <FeedbackToast
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          tone="error"
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{dialogTitle}</h2>
            <p className="text-sm text-muted-foreground">
              Define the HTML, CSS and merge variables for this template. Use Handlebars syntax such as
              {' {{firstName}} '} in your markup.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Invoice Payment Reminder"
                  className={INPUT_BASE_CLASS}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Template Type</label>
                <div className="relative">
                  <select
                    value={formValues.type}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, type: event.target.value as TemplateType }))
                    }
                    className={SELECT_BASE_CLASS}
                    required
                  >
                    {TEMPLATE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg
                      className="h-5 w-5 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {TEMPLATE_TYPE_OPTIONS.find((opt) => opt.value === formValues.type)?.description}
                </p>
              </div>

              {editingMode === 'visual' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Page Width (px)</label>
                  <input
                    type="number"
                    min="320"
                    max="1200"
                    step="10"
                    value={pageWidth}
                    onChange={(event) => {
                      const newWidth = parseInt(event.target.value, 10);
                      if (!isNaN(newWidth) && newWidth >= 320 && newWidth <= 1200) {
                        setPageWidth(newWidth);
                      }
                    }}
                    className={INPUT_BASE_CLASS}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set the width of the email template content area (320-1200px). Default is 640px.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">CSS Styles (optional)</label>
                <textarea
                  value={formValues.cssContent}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, cssContent: event.target.value }))
                  }
                  rows={8}
                  className={TEXTAREA_MONO_CLASS}
                  placeholder={`body {\n  background: #ffffff;\n  color: #111827;\n}`}
                />
                <p className="text-xs text-muted-foreground">
                  These styles are injected into the &lt;head&gt; of the rendered template.
                </p>
              </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Variables</span>
                    <button
                      type="button"
                      onClick={() => setVariables((prev) => [...prev, newVariable()])}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      Add Variable
                    </button>
                  </div>

                  <div className="space-y-3">
                    {variables.map((variable, index) => (
                    <div
                      key={variable.id}
                      className="rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          Variable {index + 1}
                        </span>
                        {variables.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(variable.id)}
                            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground/80 hover:text-muted-foreground"
                            aria-label="Remove variable"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                        <div className="mt-2 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Key</label>
                          <input
                            type="text"
                            value={variable.key}
                            onChange={(event) =>
                              handleVariableChange(variable.id, 'key', event.target.value)
                            }
                            placeholder="firstName"
                            className={INPUT_DENSE_CLASS}
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Refer to this variable as {'{{'} {variable.key || 'key'} {'}}'} in the HTML.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Description</label>
                          <input
                            type="text"
                            value={variable.description}
                            onChange={(event) =>
                              handleVariableChange(variable.id, 'description', event.target.value)
                            }
                            placeholder="Recipient first name"
                            className={INPUT_DENSE_CLASS}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Sample Value (string or JSON)
                          </label>
                          <textarea
                            value={variable.sampleValue}
                            onChange={(event) =>
                              handleVariableChange(variable.id, 'sampleValue', event.target.value)
                            }
                            rows={3}
                            placeholder='"Taylor" or {"amount": 299}'
                            className={TEXTAREA_MONO_CLASS}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <label className="text-sm font-medium text-muted-foreground">Visibility</label>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formValues.isActive}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Template is active and available for use.</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formValues.isDefault}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, isDefault: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mark as the default template for this type.</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Only one template per type can be default. Saving will automatically mark other templates as non-default.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Template Content</label>
                  <div className="inline-flex items-center rounded-lg border border-border bg-muted/20 p-1">
                    <button
                      type="button"
                      onClick={() => setEditingMode('visual')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        editingMode === 'visual'
                          ? 'bg-white text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Visual Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMode('html')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        editingMode === 'html'
                          ? 'bg-white text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>

                {editingMode === 'visual' ? (
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">
                      Assemble your email using pre-built content blocks. Switching back to the raw HTML editor is always possible.
                    </p>
                    <TemplateBlockEditor
                      blocks={blocks}
                      onChange={setBlocks}
                      availableVariables={variables
                        .map((variable) => variable.key.trim())
                        .filter(Boolean)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={formValues.htmlContent}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, htmlContent: event.target.value }))
                      }
                      onPaste={(event) => {
                        // Auto-detect if pasted HTML can be converted to blocks
                        const pastedText = event.clipboardData.getData('text/html') || event.clipboardData.getData('text/plain');
                        if (pastedText && pastedText.includes('<') && (pastedText.includes('table') || pastedText.includes('h1') || pastedText.includes('h2') || pastedText.includes('h3'))) {
                          // Small delay to let paste complete, then check
                          // Store textarea reference before setTimeout
                          const textarea = event.currentTarget;
                          setTimeout(() => {
                            // Get the updated value after paste
                            if (!textarea) return;
                            const updatedHtml = textarea.value;
                            const parsedBlocks = parseHtmlToBlocks(updatedHtml);
                            if (parsedBlocks && parsedBlocks.length > 0) {
                              const shouldConvert = window.confirm(
                                'Detected HTML structure that can be converted to blocks. Would you like to convert it now?',
                              );
                              if (shouldConvert) {
                                const extractedPageWidth = extractPageWidthFromHtml(updatedHtml);
                                setBlocks(parsedBlocks);
                                setPageWidth(extractedPageWidth);
                                setEditingMode('visual');
                              }
                            }
                          }, 100);
                        }
                      }}
                      rows={28}
                      spellCheck={false}
                      className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs leading-5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={DEFAULT_HTML}
                    />
                    <p className="text-xs text-muted-foreground">
                      Build markup using Handlebars tokens. You can include conditionals like
                      {' {{#if isOverdue}}...{{/if}} '}.
                      {' '}Paste HTML generated from blocks to automatically convert it back to blocks.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        // Try to parse HTML to blocks
                        const parsedBlocks = parseHtmlToBlocks(formValues.htmlContent);
                        
                        if (parsedBlocks && parsedBlocks.length > 0) {
                          const extractedPageWidth = extractPageWidthFromHtml(formValues.htmlContent);
                          setBlocks(parsedBlocks);
                          setPageWidth(extractedPageWidth);
                          setEditingMode('visual');
                        } else {
                          // If parsing fails, ask user if they want to switch anyway
                          const confirmSwitch = window.confirm(
                            'Could not automatically convert HTML to blocks. The HTML structure may not match the block system format.\n\n' +
                            'Would you like to switch to visual builder anyway? This will create a raw HTML block with your current content.',
                          );

                          if (confirmSwitch) {
                            setBlocks([createRawHtmlBlock(formValues.htmlContent)]);
                            setEditingMode('visual');
                          }
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      Convert to Blocks
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4 rounded-lg border border-border bg-muted/15 p-4">
              {DATA_CONTEXT_HELP[formValues.type] && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {DATA_CONTEXT_HELP[formValues.type].heading}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {DATA_CONTEXT_HELP[formValues.type].description}
                    </p>
                  </div>
                  {DATA_CONTEXT_HELP[formValues.type].groups?.map((group) => (
                    <div key={group.title} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">{group.title}</p>
                      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {group.items.map((item) => (
                          <li
                            key={item}
                            className="rounded border border-border bg-muted/20 px-2 py-1 font-mono text-[11px]"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {DATA_CONTEXT_HELP[formValues.type].note && (
                    <p className="text-xs text-muted-foreground">{DATA_CONTEXT_HELP[formValues.type].note}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-card-elevated px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Template' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </>
  );
}


