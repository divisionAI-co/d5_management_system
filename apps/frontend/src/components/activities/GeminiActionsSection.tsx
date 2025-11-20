import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PenSquare,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { aiActionsApi } from '@/lib/api/ai-actions';
import { useToast } from '@/components/ui/use-toast';
import type {
  AiActionAttachment,
  AiActionExecution,
  AiActionSummary,
  AiEntityType,
  AiFieldDefinition,
} from '@/types/ai-actions';
import { cn } from '@/lib/utils';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

type ActivityEntityType =
  | 'customer'
  | 'lead'
  | 'opportunity'
  | 'candidate'
  | 'employee'
  | 'contact'
  | 'task'
  | 'quote'
  | 'recruiter-performance-report'
  | 'sales-performance-report';

function toAiEntityType(entityType: ActivityEntityType): AiEntityType {
  if (entityType === 'recruiter-performance-report') {
    return 'RECRUITER_PERFORMANCE_REPORT';
  }
  if (entityType === 'sales-performance-report') {
    return 'SALES_PERFORMANCE_REPORT';
  }
  return entityType.toUpperCase().replace(/-/g, '_') as AiEntityType;
}

interface GeminiActionsSectionProps {
  entityId: string;
  entityType: ActivityEntityType;
  onDismiss?: () => void;
}

interface AttachModalProps {
  availableActions: AiActionSummary[];
  onClose: () => void;
  onSelect: (actionId: string) => void;
  isAttaching: boolean;
}

interface AdhocModalProps {
  fields: AiFieldDefinition[];
  onClose: () => void;
  onSubmit: (payload: { prompt: string; selectedFields: string[]; model?: string; extra?: string; runOnAll?: boolean; operationType?: 'UPDATE' | 'CREATE' | 'READ_ONLY'; fieldMappings?: Array<{ sourceKey: string; targetField: string; transformRule?: string | null }> }) => void;
  isSubmitting: boolean;
  defaultPrompt?: string;
  operationType?: 'UPDATE' | 'CREATE' | 'READ_ONLY';
  fieldMappings?: Array<{ sourceKey: string; targetField: string; transformRule?: string | null }>;
}

interface ExecutionResultModalProps {
  execution: AiActionExecution | null;
  onClose: () => void;
  onApply?: () => void;
}

interface ExecuteActionModalProps {
  actionName: string;
  entityType: string;
  onClose: () => void;
  onExecute: (runOnAll: boolean) => void;
  isExecuting: boolean;
}

function AttachActionModal({
  availableActions,
  onClose,
  onSelect,
  isAttaching,
}: AttachModalProps) {
  const [selectedActionId, setSelectedActionId] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-foreground">Attach Gemini Action</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {availableActions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p>No saved Gemini actions are available for this entity type yet.</p>
            </div>
          ) : (
            availableActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => setSelectedActionId(action.id)}
                className={cn(
                  'w-full rounded-lg border px-4 py-3 text-left transition',
                  selectedActionId === action.id
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                    : 'border-border hover:border-blue-500 hover:bg-muted/60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{action.name}</p>
                    {action.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {action.fields.length} field{action.fields.length === 1 ? '' : 's'}
                      </span>
                      {action.model && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {action.model}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedActionId || isAttaching}
            onClick={() => selectedActionId && onSelect(selectedActionId)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAttaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Attach
          </button>
        </div>
      </div>
    </div>
  );
}

function AdhocPromptModal({
  fields,
  onClose,
  onSubmit,
  isSubmitting,
  defaultPrompt,
  operationType,
  fieldMappings,
}: AdhocModalProps) {
  const [selected, setSelected] = useState<string[]>(fields.slice(0, 3).map((field) => field.key));
  const [prompt, setPrompt] = useState<string>(defaultPrompt ?? '');
  const [model, setModel] = useState<string>('');
  const [extra, setExtra] = useState<string>('');
  const [runOnAll, setRunOnAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleField = (fieldKey: string) => {
    setSelected((prev) =>
      prev.includes(fieldKey) ? prev.filter((key) => key !== fieldKey) : [...prev, fieldKey],
    );
  };

  const handleSubmit = () => {
    setError(null);
    if (!prompt.trim()) {
      setError('Provide a prompt before executing.');
      return;
    }
    if (selected.length === 0) {
      setError('Select at least one field to send to Gemini.');
      return;
    }
    onSubmit({
      prompt: prompt.trim(),
      selectedFields: selected,
      model: model.trim() || undefined,
      extra: extra.trim() || undefined,
      runOnAll,
      operationType,
      fieldMappings,
    });
  };

  return (
    <>
      {error && (
        <FeedbackToast message={error} onDismiss={() => setError(null)} tone="error" />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <PenSquare className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-foreground">Run Ad-hoc Gemini Prompt</h3>
            {operationType && operationType !== 'READ_ONLY' && (
              <span className={cn(
                'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                operationType === 'UPDATE' 
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
              )}>
                {operationType}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 grid gap-4 overflow-y-auto px-5 py-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase text-muted-foreground">
              Prompt
            </label>
            <textarea
              rows={10}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe what you want Gemini to do, e.g. “Summarise this candidate in 5 bullet points focused on leadership.”"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <label className="block text-xs font-semibold uppercase text-muted-foreground">
              Additional instructions (optional)
            </label>
            <textarea
              rows={4}
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              placeholder="Provide any extra context Gemini should follow."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground">
                Fields to include
              </label>
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-background/60 p-3 text-sm">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted/60',
                      selected.includes(field.key) && 'bg-blue-500/10 text-blue-600 dark:text-blue-200',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold">
                        {field.label}{' '}
                        <span className="text-xs font-normal text-muted-foreground">({field.key})</span>
                      </span>
                      {field.description && (
                        <span className="text-xs text-muted-foreground">{field.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground">
                Model override (optional)
              </label>
              <input
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gemini-1.5-flash-latest"
                className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {operationType && operationType !== 'READ_ONLY' && fieldMappings && fieldMappings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      This prompt will {operationType.toLowerCase()} records
                    </p>
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      Gemini's response will be mapped to database fields. Review proposed changes before applying.
                    </p>
                    {fieldMappings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Field mappings:</p>
                        {fieldMappings.slice(0, 3).map((mapping, idx) => (
                          <p key={idx} className="text-xs text-amber-700 dark:text-amber-300">
                            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                              {mapping.sourceKey}
                            </code>
                            {' → '}
                            <span className="text-amber-800 dark:text-amber-200">{mapping.targetField}</span>
                          </p>
                        ))}
                        {fieldMappings.length > 3 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            +{fieldMappings.length - 3} more mapping{fieldMappings.length - 3 === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3">
              <input
                type="checkbox"
                id="runOnAll"
                checked={runOnAll}
                onChange={(e) => setRunOnAll(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="runOnAll" className="text-xs text-foreground">
                <span className="block font-semibold">Run on all records</span>
                <span className="mt-1 block text-muted-foreground">
                  Execute this prompt across all {fields.length > 0 ? 'records' : 'entities'} of this type instead of just this one.
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4 flex-shrink-0">
          <div className="text-xs text-muted-foreground">
            Gemini requests may take a few seconds. Results appear in the activity timeline automatically.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run with Gemini
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function ExecuteActionModal({ actionName, entityType, onClose, onExecute, isExecuting }: ExecuteActionModalProps) {
  const [runOnAll, setRunOnAll] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-foreground">Run Action</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{actionName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose how to execute this action</p>
          </div>
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-4 cursor-pointer transition hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
              <input
                type="radio"
                name="executionMode"
                checked={!runOnAll}
                onChange={() => setRunOnAll(false)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">This record only</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Run the action on the current {entityType} record
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-4 cursor-pointer transition hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
              <input
                type="radio"
                name="executionMode"
                checked={runOnAll}
                onChange={() => setRunOnAll(true)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">All records</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Run the action across all {entityType} records
                </p>
              </div>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onExecute(runOnAll)}
            disabled={isExecuting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Action
          </button>
        </div>
      </div>
    </div>
  );
}

function ExecutionResultModal({ execution, onClose, onApply }: ExecutionResultModalProps) {
  if (!execution) return null;

  const outputText =
    typeof execution.output?.text === 'string'
      ? execution.output.text
      : execution.rawOutput ?? JSON.stringify(execution.output ?? {}, null, 2);

  const hasProposedChanges = execution.proposedChanges && Object.keys(execution.proposedChanges.fields || {}).length > 0;
  const isApplied = !!execution.appliedAt;
  const proposedChanges = execution.proposedChanges;
  
  // Safely format applied date
  const formatAppliedDate = (dateValue: string | Date | null | undefined): string | null => {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    } catch {
      // Invalid date
    }
    return null;
  };
  
  const appliedDateString = formatAppliedDate(execution.appliedAt);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-foreground">
              {hasProposedChanges ? 'Review Changes' : 'Gemini Output'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm text-foreground">
          {execution.status === 'FAILED' ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Gemini request failed</p>
                <p className="mt-1">{execution.errorMessage ?? 'Unknown error occurred.'}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold text-muted-foreground">
                Generated {execution.createdAt ? new Date(execution.createdAt).toLocaleString() : 'Unknown'}
                {isApplied && appliedDateString && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/20 dark:text-green-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Applied {appliedDateString}
                  </span>
                )}
              </p>

              {hasProposedChanges && !isApplied && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      Proposed {proposedChanges?.operation === 'CREATE' ? 'New Record' : 'Changes'}
                    </h4>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Review the changes below before applying them to the database.
                  </p>
                  <div className="space-y-2 rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-card">
                    {proposedChanges &&
                      Object.entries(proposedChanges.fields).map(([fieldKey, change]) => (
                        <div key={fieldKey} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{fieldKey}</p>
                            {proposedChanges.operation === 'UPDATE' && (
                              <div className="mt-1 space-y-1">
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Current: </span>
                                  <span className="font-mono text-red-600 dark:text-red-400">
                                    {change.oldValue === null || change.oldValue === undefined
                                      ? '(empty)'
                                      : String(change.oldValue)}
                                  </span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-muted-foreground">New: </span>
                                  <span className="font-mono text-green-600 dark:text-green-400">
                                    {String(change.newValue)}
                                  </span>
                                </div>
                              </div>
                            )}
                            {proposedChanges.operation === 'CREATE' && (
                              <div className="mt-1 text-xs">
                                <span className="text-muted-foreground">Value: </span>
                                <span className="font-mono text-green-600 dark:text-green-400">
                                  {String(change.newValue)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {!hasProposedChanges && !isApplied && execution.status === 'SUCCESS' && execution.action?.operationType && execution.action.operationType !== 'READ_ONLY' && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                      No Changes Detected
                    </h4>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This action is configured to <strong>{execution.action.operationType.toLowerCase()}</strong> records, but no field changes were detected from Gemini's response.
                  </p>
                  {execution.action.fieldMappings && execution.action.fieldMappings.length > 0 && (
                    <div className="rounded border border-purple-300 bg-purple-100/50 p-3 dark:border-purple-700 dark:bg-purple-900/30">
                      <p className="text-xs font-semibold text-purple-900 dark:text-purple-100">Expected field mappings:</p>
                      <div className="mt-2 space-y-1">
                        {execution.action.fieldMappings.map((mapping) => (
                          <div key={mapping.id} className="flex items-center gap-2 text-xs">
                            <code className="rounded bg-purple-200 px-1.5 py-0.5 font-mono text-purple-900 dark:bg-purple-800 dark:text-purple-100">
                              {mapping.sourceKey}
                            </code>
                            <span className="text-purple-700 dark:text-purple-300">→</span>
                            <span className="text-purple-700 dark:text-purple-300">{mapping.targetField}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
                        Gemini's response must be JSON with these exact keys: <code className="rounded bg-purple-200 px-1 py-0.5 font-mono text-purple-900 dark:bg-purple-800 dark:text-purple-100">{execution.action.fieldMappings.map(m => m.sourceKey).join(', ')}</code>
                      </p>
                    </div>
                  )}
                  <div className="rounded border border-amber-300 bg-amber-100/50 p-3 dark:border-amber-700 dark:bg-amber-900/30">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">Common causes:</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-700 dark:text-amber-300">
                      <li><strong>Gemini didn't return JSON:</strong> The response must be valid JSON for field mapping</li>
                      <li><strong>Field mapping keys don't match:</strong> The sourceKey in your field mappings must match exactly the keys in Gemini's JSON response</li>
                      <li><strong>Empty or null values:</strong> Gemini returned JSON but all mapped fields were empty/null</li>
                    </ul>
                  </div>
                  <div className="rounded border border-blue-300 bg-blue-100/50 p-3 dark:border-blue-700 dark:bg-blue-900/30">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">How to fix:</p>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-blue-700 dark:text-blue-300">
                      <li>Check the <strong>Gemini Response</strong> below - is it valid JSON?</li>
                      <li>If not JSON, update your prompt to explicitly ask for JSON with specific keys</li>
                      <li>Verify the response contains the expected keys shown above</li>
                      <li>Check backend logs for detailed field mapping diagnostics</li>
                    </ol>
                  </div>
                </div>
              )}

              {isApplied && execution.appliedChanges && (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-950/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Applied Changes</h4>
                  </div>
                  <div className="space-y-2 rounded-lg border border-green-200 bg-white p-3 dark:border-green-800 dark:bg-card">
                    {Object.entries(execution.appliedChanges.fields).map(([fieldKey, change]) => (
                      <div key={fieldKey} className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{fieldKey}</p>
                          {execution.appliedChanges?.operation === 'UPDATE' && (
                            <div className="mt-1 space-y-1 text-xs">
                              <div>
                                <span className="text-muted-foreground">Was: </span>
                                <span className="font-mono text-red-600 dark:text-red-400">
                                  {change.oldValue === null || change.oldValue === undefined
                                    ? '(empty)'
                                    : String(change.oldValue)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Now: </span>
                                <span className="font-mono text-green-600 dark:text-green-400">
                                  {String(change.newValue)}
                                </span>
                              </div>
                            </div>
                          )}
                          {execution.appliedChanges?.operation === 'CREATE' && (
                            <div className="mt-1 text-xs">
                              <span className="text-muted-foreground">Created with: </span>
                              <span className="font-mono text-green-600 dark:text-green-400">
                                {String(change.newValue)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 font-semibold text-muted-foreground">Gemini Response</p>
                <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <MarkdownRenderer
                    content={outputText || 'Gemini returned an empty response.'}
                    className="text-sm text-foreground"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(outputText ?? '');
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Copy
          </button>
          {hasProposedChanges && !isApplied && execution.status === 'SUCCESS' && onApply && (
            <button
              type="button"
              onClick={onApply}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              Apply Changes
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function GeminiActionsSection({ entityId, entityType }: GeminiActionsSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const aiEntityType = useMemo(() => toAiEntityType(entityType), [entityType]);

  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showAdhocModal, setShowAdhocModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [selectedActionForExecution, setSelectedActionForExecution] = useState<{ actionId: string; actionName: string } | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<AiActionExecution | null>(null);
  const [defaultAdhocPrompt, setDefaultAdhocPrompt] = useState<string>('');
  const [adhocOperationType, setAdhocOperationType] = useState<'UPDATE' | 'CREATE' | 'READ_ONLY' | undefined>(undefined);
  const [adhocFieldMappings, setAdhocFieldMappings] = useState<Array<{ sourceKey: string; targetField: string; transformRule?: string | null }> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const attachmentsQuery = useQuery({
    queryKey: ['ai-actions', 'attachments', aiEntityType, entityId],
    queryFn: () => aiActionsApi.listAttachments({ entityType: aiEntityType, entityId }),
  });

  // const executionsQuery = useQuery({
  //   queryKey: ['ai-actions', 'executions', aiEntityType, entityId],
  //   queryFn: () => aiActionsApi.listExecutions({ entityType: aiEntityType, entityId, limit: 10 }),
  // });

  const availableActionsQuery = useQuery({
    queryKey: ['ai-actions', 'available', aiEntityType],
    queryFn: () => aiActionsApi.list({ entityType: aiEntityType }),
    enabled: showAttachModal,
  });

  const fieldsQuery = useQuery({
    queryKey: ['ai-actions', 'fields', aiEntityType],
    queryFn: () => aiActionsApi.listFields(aiEntityType),
    enabled: showAdhocModal,
  });

  const attachMutation = useMutation({
    mutationFn: (actionId: string) => aiActionsApi.attach(actionId, entityId),
    onSuccess: () => {
      setError(null);
      toast({
        title: 'Action attached',
        description: 'The Gemini action is now accessible from this record.',
      });
      setShowAttachModal(false);
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'attachments', aiEntityType, entityId] });
    },
    onError: () => {
      setError('Could not attach action. Please try again in a moment.');
      toast({
        title: 'Could not attach action',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const detachMutation = useMutation({
    mutationFn: (attachmentId: string) => aiActionsApi.detach(attachmentId),
    onSuccess: () => {
      setError(null);
      toast({
        title: 'Action detached',
        description: 'The Gemini action is no longer linked to this record.',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'attachments', aiEntityType, entityId] });
    },
    onError: () => {
      setError('Could not detach action. Please try again in a moment.');
      toast({
        title: 'Could not detach action',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const executeSavedMutation = useMutation({
    mutationFn: ({
      actionId,
      payload,
    }: {
      actionId: string;
      payload: { fieldKeys?: string[]; promptOverride?: string; extraInstructions?: string; runOnAll?: boolean };
    }) => aiActionsApi.executeSaved(actionId, { 
      ...(payload.runOnAll ? {} : { entityId }), 
      fieldKeys: payload.fieldKeys,
      promptOverride: payload.promptOverride,
      extraInstructions: payload.extraInstructions,
    }),
    onSuccess: (execution, variables) => {
      setError(null);
      const isBulk = variables.payload.runOnAll;
      toast({
        title: 'Gemini request started',
        description: isBulk 
          ? 'Running on all records. The response will appear shortly.'
          : 'The response will appear in the activity timeline shortly.',
      });
      setSelectedExecution(execution);
      if (!isBulk) {
        queryClient.invalidateQueries({ queryKey: ['ai-actions', 'attachments', aiEntityType, entityId] });
        queryClient.invalidateQueries({ queryKey: ['ai-actions', 'executions', aiEntityType, entityId] });
        queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['ai-actions', 'executions', aiEntityType] });
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Gemini request failed.';
      setError(message);
      toast({
        title: 'Could not run action',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const executeAdhocMutation = useMutation({
    mutationFn: ({
      prompt,
      selectedFields,
      model,
      extraInstructions,
      runOnAll,
      operationType,
      fieldMappings,
    }: {
      prompt: string;
      selectedFields: string[];
      model?: string;
      extraInstructions?: string;
      runOnAll?: boolean;
      operationType?: 'UPDATE' | 'CREATE' | 'READ_ONLY';
      fieldMappings?: Array<{ sourceKey: string; targetField: string; transformRule?: string | null }>;
    }) =>
      aiActionsApi.executeAdhoc({
        entityType: aiEntityType,
        ...(runOnAll ? {} : { entityId }),
        prompt,
        fieldKeys: selectedFields,
        model,
        extraInstructions,
        operationType,
        fieldMappings,
      }),
    onSuccess: (execution, variables) => {
      setError(null);
      const isBulk = variables.runOnAll;
      toast({
        title: 'Gemini request started',
        description: isBulk 
          ? 'Running on all records. The response will appear shortly.'
          : 'The response will appear in the activity timeline shortly.',
      });
      setShowAdhocModal(false);
      setSelectedExecution(execution);
      if (!isBulk) {
        queryClient.invalidateQueries({ queryKey: ['ai-actions', 'executions', aiEntityType, entityId] });
        queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['ai-actions', 'executions', aiEntityType] });
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Gemini request failed.';
      setError(message);
      toast({
        title: 'Could not run prompt',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (executionId: string) => aiActionsApi.applyChanges(executionId),
    onSuccess: (updatedExecution) => {
      setError(null);
      toast({
        title: 'Changes applied',
        description: 'The proposed changes have been successfully applied to the database.',
      });
      setSelectedExecution(updatedExecution);
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'executions', aiEntityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'executions', aiEntityType] });
      // Invalidate entity queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [entityType, entityId] });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Could not apply changes.';
      setError(message);
      toast({
        title: 'Could not apply changes',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const attachments = attachmentsQuery.data ?? [];

  const availableActions = useMemo(() => {
    const alreadyAttachedIds = new Set(attachments.map((attachment) => attachment.actionId));
    return (availableActionsQuery.data ?? []).filter((action) => action.isActive && !alreadyAttachedIds.has(action.id));
  }, [attachments, availableActionsQuery.data]);

  return (
    <>
      {error && (
        <FeedbackToast
          message={error}
          onDismiss={() => setError(null)}
          tone="error"
        />
      )}

      <div className="max-h-[32rem] space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Gemini actions</h2>
          <p className="text-xs text-muted-foreground">
            Run saved AI scripts or craft ad-hoc prompts using Gemini. Outputs are stored as activities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDefaultAdhocPrompt('');
              setAdhocOperationType(undefined);
              setAdhocFieldMappings(undefined);
              setShowAdhocModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <PenSquare className="h-4 w-4" />
            Run ad-hoc prompt
          </button>
          <button
            type="button"
            onClick={() => setShowAttachModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Attach action
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Attached actions</h3>
          {attachmentsQuery.isLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading Gemini actions…
            </div>
          ) : attachments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              No Gemini actions attached yet. Attach a saved action to run it quickly from this record.
            </div>
          ) : (
            <div className="space-y-3">
              {attachments.map((attachment: AiActionAttachment) => (
                <div
                  key={attachment.id}
                  className="rounded-lg border border-border bg-background px-4 py-4 shadow-sm transition hover:border-blue-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{attachment.action.name}</p>
                      {attachment.action.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {attachment.action.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => detachMutation.mutate(attachment.id)}
                      className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <MessageCircle className="h-3 w-3" />
                      {attachment.action.fields.length} field
                      {attachment.action.fields.length === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                      Attached {new Date(attachment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedActionForExecution({ actionId: attachment.actionId, actionName: attachment.action.name });
                        setShowExecuteModal(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      {executeSavedMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Run action
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultAdhocPrompt(attachment.action.promptTemplate);
                        setAdhocOperationType(attachment.action.operationType);
                        setAdhocFieldMappings(attachment.action.fieldMappings?.map(m => ({
                          sourceKey: m.sourceKey,
                          targetField: m.targetField,
                          transformRule: m.transformRule ?? null,
                        })));
                        setShowAdhocModal(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <PenSquare className="h-4 w-4" />
                      Tweak prompt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAttachModal && (
        <AttachActionModal
          availableActions={availableActions}
          onClose={() => setShowAttachModal(false)}
          onSelect={(actionId) => attachMutation.mutate(actionId)}
          isAttaching={attachMutation.isPending}
        />
      )}

      {showAdhocModal && fieldsQuery.data && (
        <AdhocPromptModal
          fields={fieldsQuery.data}
          onClose={() => {
            setShowAdhocModal(false);
            setDefaultAdhocPrompt('');
            setAdhocOperationType(undefined);
            setAdhocFieldMappings(undefined);
          }}
          onSubmit={({ prompt, selectedFields, model, extra, runOnAll, operationType, fieldMappings }) =>
            executeAdhocMutation.mutate({
              prompt,
              selectedFields,
              model,
              extraInstructions: extra,
              runOnAll,
              operationType,
              fieldMappings,
            })
          }
          isSubmitting={executeAdhocMutation.isPending}
          defaultPrompt={defaultAdhocPrompt}
          operationType={adhocOperationType}
          fieldMappings={adhocFieldMappings}
        />
      )}

      {showExecuteModal && selectedActionForExecution && (
        <ExecuteActionModal
          actionName={selectedActionForExecution.actionName}
          entityType={entityType}
          onClose={() => {
            setShowExecuteModal(false);
            setSelectedActionForExecution(null);
          }}
          onExecute={(runOnAll) => {
            executeSavedMutation.mutate({
              actionId: selectedActionForExecution.actionId,
              payload: { runOnAll },
            });
            setShowExecuteModal(false);
            setSelectedActionForExecution(null);
          }}
          isExecuting={executeSavedMutation.isPending}
        />
      )}

      <ExecutionResultModal
        execution={selectedExecution}
        onClose={() => {
          setSelectedExecution(null);
        }}
        onApply={
          selectedExecution && 
          !selectedExecution.appliedAt && 
          selectedExecution.proposedChanges &&
          Object.keys(selectedExecution.proposedChanges.fields || {}).length > 0
            ? () => {
                if (selectedExecution) {
                  applyMutation.mutate(selectedExecution.id);
                }
              }
            : undefined
        }
      />
      </div>
    </>
  );
}


