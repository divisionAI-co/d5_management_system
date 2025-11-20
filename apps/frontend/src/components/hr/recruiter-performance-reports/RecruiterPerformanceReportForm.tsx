import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recruiterPerformanceReportsApi } from '@/lib/api/hr/recruiter-performance-reports';
import { positionsApi } from '@/lib/api/recruitment/positions';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import type {
  RecruiterPerformanceReport,
  CreateRecruiterPerformanceReportDto,
  UpdateRecruiterPerformanceReportDto,
  Win,
  Challenge,
  Priority,
  TopPerformingSource,
  PipelineStatus,
} from '@/types/recruiter-performance-reports';
import { Plus, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

// Common candidate sources
const CANDIDATE_SOURCES = [
  'LinkedIn Outreach',
  'LinkedIn Job Posting',
  'Job Boards (Indeed, Monster, etc.)',
  'Company Website',
  'Employee Referral',
  'Direct Application',
  'Recruitment Agency',
  'Social Media',
  'University/College',
  'Tech Meetups/Events',
  'GitHub',
  'Stack Overflow',
  'Other',
] as const;

interface RecruiterPerformanceReportFormProps {
  report?: RecruiterPerformanceReport;
  initialPositionId?: string;
  initialPositionTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type FormValues = {
  positionId: string;
  weekEnding: string;
  positionTitle: string;
  candidatesContactedActual: number;
  candidatesContactedTarget: number;
  culturalCallsActual: number;
  culturalCallsTarget: number;
  technicalCallsActual: number;
  technicalCallsTarget: number;
  clientInterviewsScheduledActual: number;
  clientInterviewsScheduledTarget: number;
  placementsThisWeek: number;
  wins: Win[];
  challenges: Challenge[];
  priorities: Priority[];
  topPerformingSources: Array<TopPerformingSource & { customSource?: string }>;
  pipelineStatus: {
    role: string;
    pipeline: string;
    confidenceLevel: string;
    notes?: string;
  };
};

export function RecruiterPerformanceReportForm({
  report,
  initialPositionId,
  initialPositionTitle,
  onClose,
  onSuccess,
}: RecruiterPerformanceReportFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!report;
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Fetch positions
  const { data: positionsData } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.list({ page: 1, pageSize: 100 }),
  });

  const positions = positionsData?.data || [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      positionId: report?.positionId || initialPositionId || '',
      weekEnding: report?.weekEnding
        ? format(new Date(report.weekEnding), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      positionTitle: report?.positionTitle || initialPositionTitle || '',
      candidatesContactedActual: report?.candidatesContactedActual || 0,
      candidatesContactedTarget: report?.candidatesContactedTarget || 0,
      culturalCallsActual: report?.culturalCallsActual || 0,
      culturalCallsTarget: report?.culturalCallsTarget || 0,
      technicalCallsActual: report?.technicalCallsActual || 0,
      technicalCallsTarget: report?.technicalCallsTarget || 0,
      clientInterviewsScheduledActual: report?.clientInterviewsScheduledActual || 0,
      clientInterviewsScheduledTarget: report?.clientInterviewsScheduledTarget || 0,
      placementsThisWeek: report?.placementsThisWeek || 0,
      wins: report?.wins || [],
      challenges: report?.challenges || [],
      priorities: report?.priorities || [],
      topPerformingSources: report?.topPerformingSources
        ? report.topPerformingSources.map((s) => {
            // If source is not in the predefined list, set as "Other" with customSource
            const isStandardSource = (CANDIDATE_SOURCES as readonly string[]).includes(s.source);
            return {
              ...s,
              source: isStandardSource ? s.source : 'Other',
              customSource: isStandardSource ? undefined : s.source,
            };
          })
        : [],
      pipelineStatus: report?.pipelineStatus
        ? {
            role: report.pipelineStatus.role || '',
            pipeline: report.pipelineStatus.pipeline || '',
            confidenceLevel: report.pipelineStatus.confidenceLevel || '',
            notes: report.pipelineStatus.notes || '',
          }
        : {
            role: '',
            pipeline: '',
            confidenceLevel: '',
            notes: '',
          },
    },
  });

  const {
    fields: winFields,
    append: appendWin,
    remove: removeWin,
  } = useFieldArray({
    control,
    name: 'wins',
  });

  const {
    fields: challengeFields,
    append: appendChallenge,
    remove: removeChallenge,
  } = useFieldArray({
    control,
    name: 'challenges',
  });

  const {
    fields: priorityFields,
    append: appendPriority,
    remove: removePriority,
  } = useFieldArray({
    control,
    name: 'priorities',
  });

  const {
    fields: sourceFields,
    append: appendSource,
    remove: removeSource,
  } = useFieldArray({
    control,
    name: 'topPerformingSources',
  });

  // Auto-fill position title when position is selected
  const selectedPositionId = watch('positionId');
  useEffect(() => {
    if (selectedPositionId) {
      const position = positions.find((p) => p.id === selectedPositionId);
      if (position) {
        setValue('positionTitle', position.title);
      }
    }
  }, [selectedPositionId, positions, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: CreateRecruiterPerformanceReportDto) =>
      recruiterPerformanceReportsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-performance-reports'] });
      setFeedback({
        message: 'Report created successfully',
        tone: 'success',
      });
      setTimeout(() => {
        onSuccess();
      }, 1000);
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to create report',
        tone: 'error',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecruiterPerformanceReportDto }) =>
      recruiterPerformanceReportsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-performance-reports'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-performance-report', report?.id] });
      setFeedback({
        message: 'Report updated successfully',
        tone: 'success',
      });
      setTimeout(() => {
        onSuccess();
      }, 1000);
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to update report',
        tone: 'error',
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    // Process topPerformingSources: if source is "Other", use customSource
    const processedSources = data.topPerformingSources
      .filter((s) => s.source) // Only include sources that have a value
      .map((s) => ({
        source: s.source === 'Other' && s.customSource ? s.customSource : s.source,
        count: s.count,
      }));

    const basePayload = {
      weekEnding: data.weekEnding,
      positionTitle: data.positionTitle,
      candidatesContactedActual: data.candidatesContactedActual,
      candidatesContactedTarget: data.candidatesContactedTarget,
      culturalCallsActual: data.culturalCallsActual,
      culturalCallsTarget: data.culturalCallsTarget,
      technicalCallsActual: data.technicalCallsActual,
      technicalCallsTarget: data.technicalCallsTarget,
      clientInterviewsScheduledActual: data.clientInterviewsScheduledActual,
      clientInterviewsScheduledTarget: data.clientInterviewsScheduledTarget,
      placementsThisWeek: data.placementsThisWeek,
      wins: data.wins.length > 0 ? data.wins : undefined,
      challenges: data.challenges.length > 0 ? data.challenges : undefined,
      priorities: data.priorities.length > 0 ? data.priorities : undefined,
      topPerformingSources: processedSources.length > 0 ? processedSources : undefined,
      pipelineStatus:
        data.pipelineStatus && (data.pipelineStatus.role || data.pipelineStatus.pipeline || data.pipelineStatus.confidenceLevel)
          ? data.pipelineStatus
          : undefined,
    };

    if (isEdit) {
      // Update: don't include positionId
      updateMutation.mutate({ id: report.id, data: basePayload });
    } else {
      // Create: include positionId
      createMutation.mutate({ ...basePayload, positionId: data.positionId } as CreateRecruiterPerformanceReportDto);
    }
  };

  return (
    <>
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Position <span className="text-red-500">*</span>
            </label>
            <select
              {...register('positionId', { required: !isEdit })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={isEdit}
            >
              <option value="">Select Position</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.title}
                </option>
              ))}
            </select>
            {errors.positionId && (
              <p className="text-sm text-red-500 mt-1">Position is required</p>
            )}
          </div>
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">
              Position Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('positionTitle', { required: true })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., ServiceNow Developer"
            />
            {errors.positionTitle && (
              <p className="text-sm text-red-500 mt-1">Position title is required</p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Performance Funnel & Efficiency Ratios</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Candidates Contacted (Actual)
            </label>
            <input
              type="number"
              {...register('candidatesContactedActual', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Candidates Contacted (Target)
            </label>
            <input
              type="number"
              {...register('candidatesContactedTarget', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Cultural Calls (Actual)
            </label>
            <input
              type="number"
              {...register('culturalCallsActual', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Cultural Calls (Target)
            </label>
            <input
              type="number"
              {...register('culturalCallsTarget', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Technical Calls (Actual)
            </label>
            <input
              type="number"
              {...register('technicalCallsActual', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Technical Calls (Target)
            </label>
            <input
              type="number"
              {...register('technicalCallsTarget', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Client Interviews Scheduled (Actual)
            </label>
            <input
              type="number"
              {...register('clientInterviewsScheduledActual', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Client Interviews Scheduled (Target)
            </label>
            <input
              type="number"
              {...register('clientInterviewsScheduledTarget', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Placements This Week
            </label>
            <input
              type="number"
              {...register('placementsThisWeek', { valueAsNumber: true, min: 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Wins */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Key Wins & Accomplishments</h3>
          <button
            type="button"
            onClick={() => appendWin({ description: '' })}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Win
          </button>
        </div>
        {winFields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <input
              {...register(`wins.${index}.description` as const)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Describe the win..."
            />
            <button
              type="button"
              onClick={() => removeWin(index)}
              className="p-2 rounded hover:bg-muted text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Challenges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Challenges & Proposed Solutions</h3>
          <button
            type="button"
            onClick={() => appendChallenge({ challenge: '', proposedSolution: '' })}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Challenge
          </button>
        </div>
        {challengeFields.map((field, index) => (
          <div key={field.id} className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Challenge {index + 1}</label>
              <button
                type="button"
                onClick={() => removeChallenge(index)}
                className="p-1 rounded hover:bg-muted text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input
              {...register(`challenges.${index}.challenge` as const)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-2"
              placeholder="Describe the challenge..."
            />
            <textarea
              {...register(`challenges.${index}.proposedSolution` as const)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Proposed solution..."
              rows={2}
            />
          </div>
        ))}
      </div>

      {/* Priorities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">S.M.A.R.T. Priorities for Next Week</h3>
          <button
            type="button"
            onClick={() => appendPriority({ description: '' })}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Priority
          </button>
        </div>
        {priorityFields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <input
              {...register(`priorities.${index}.description` as const)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Describe the priority..."
            />
            <button
              type="button"
              onClick={() => removePriority(index)}
              className="p-2 rounded hover:bg-muted text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Top Performing Sources */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Top Performing Sources</h3>
          <button
            type="button"
            onClick={() => appendSource({ source: '', count: 0 })}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Source
          </button>
        </div>
        {sourceFields.map((field, index) => {
          const sourceValue = watch(`topPerformingSources.${index}.source` as const);
          const isOther = sourceValue === 'Other';
          
          return (
            <div key={field.id} className="flex gap-2">
              <select
                {...register(`topPerformingSources.${index}.source` as const)}
                className="w-64 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select Source</option>
                {CANDIDATE_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              {isOther && (
                <input
                  {...register(`topPerformingSources.${index}.customSource` as const)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Specify other source..."
                />
              )}
              <input
                type="number"
                {...register(`topPerformingSources.${index}.count` as const, {
                  valueAsNumber: true,
                  min: 0,
                })}
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Count"
              />
              <button
                type="button"
                onClick={() => removeSource(index)}
                className="p-2 rounded hover:bg-muted text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pipeline Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Pipeline Health & Source Analysis</h3>
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Role</label>
            <select
              {...register('pipelineStatus.role')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Position</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.title}>
                  {pos.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Pipeline Status</label>
            <textarea
              {...register('pipelineStatus.pipeline')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., 4 Active -> 4 Screened -> 2 Submitted -> 0 Final Interview"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Confidence Level</label>
            <select
              {...register('pipelineStatus.confidenceLevel')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select Confidence Level</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              {...register('pipelineStatus.notes')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Additional notes..."
              rows={3}
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
    </>
  );
}

