import { useMemo, useState } from 'react';
import { Archive, ChevronDown, Trash2, UserRound, Mail } from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd';
import type { Candidate } from '@/types/recruitment';
import { CandidateStage } from '@/types/recruitment';

const STAGE_ORDER: CandidateStage[] = [
  CandidateStage.VALIDATION,
  CandidateStage.CULTURAL_INTERVIEW,
  CandidateStage.TECHNICAL_INTERVIEW,
  CandidateStage.CUSTOMER_INTERVIEW,
  CandidateStage.ON_HOLD,
  CandidateStage.CUSTOMER_REVIEW,
  CandidateStage.CONTRACT_PROPOSAL,
  CandidateStage.CONTRACT_SIGNING,
  CandidateStage.HIRED,
  CandidateStage.REJECTED,
];

const STAGE_LABELS: Record<CandidateStage, string> = {
  [CandidateStage.VALIDATION]: 'Validation',
  [CandidateStage.CULTURAL_INTERVIEW]: 'Cultural Interview',
  [CandidateStage.TECHNICAL_INTERVIEW]: 'Technical Interview',
  [CandidateStage.CUSTOMER_INTERVIEW]: 'Customer Interview',
  [CandidateStage.ON_HOLD]: 'On Hold',
  [CandidateStage.CUSTOMER_REVIEW]: 'Customer Review',
  [CandidateStage.CONTRACT_PROPOSAL]: 'Contract Proposal',
  [CandidateStage.CONTRACT_SIGNING]: 'Contract Signing',
  [CandidateStage.HIRED]: 'Hired',
  [CandidateStage.REJECTED]: 'Rejected',
};

const STAGE_COLORS: Record<CandidateStage, string> = {
  [CandidateStage.VALIDATION]: 'bg-blue-100 text-blue-700',
  [CandidateStage.CULTURAL_INTERVIEW]: 'bg-purple-100 text-purple-700',
  [CandidateStage.TECHNICAL_INTERVIEW]: 'bg-amber-100 text-amber-700',
  [CandidateStage.CUSTOMER_INTERVIEW]: 'bg-cyan-100 text-cyan-700',
  [CandidateStage.ON_HOLD]: 'bg-orange-100 text-orange-700',
  [CandidateStage.CUSTOMER_REVIEW]: 'bg-teal-100 text-teal-700',
  [CandidateStage.CONTRACT_PROPOSAL]: 'bg-yellow-100 text-yellow-700',
  [CandidateStage.CONTRACT_SIGNING]: 'bg-emerald-100 text-emerald-700',
  [CandidateStage.HIRED]: 'bg-green-100 text-green-700',
  [CandidateStage.REJECTED]: 'bg-rose-100 text-rose-700',
};

interface CandidateBoardProps {
  candidates: Candidate[];
  isLoading?: boolean;
  onCreateCandidate?: () => void;
  onRefresh?: () => void;
  onView?: (candidate: Candidate) => void;
  onEdit?: (candidate: Candidate) => void;
  onMoveStage?: (candidate: Candidate, stage: CandidateStage) => void;
  onLinkPosition?: (candidate: Candidate) => void;
  onCandidateMove?: (result: DropResult, candidate: Candidate) => void;
  onConvertToEmployee?: (candidate: Candidate) => void;
  onArchive?: (candidate: Candidate) => void;
  onDelete?: (candidate: Candidate) => void;
  onUnlinkCandidate?: (candidate: Candidate) => void;
  onImportCandidates?: () => void;
  canDelete?: boolean;
  // Per-column pagination
  columnLimits?: Record<CandidateStage, number>;
  columnTotals?: Record<CandidateStage, number>;
  onLoadMore?: (stage: CandidateStage) => void;
  isLoadingMore?: Record<CandidateStage, boolean>;
}

export function CandidateBoard({
  candidates,
  isLoading,
  onCreateCandidate: _onCreateCandidate,
  onRefresh: _onRefresh,
  onView,
  onEdit,
  onMoveStage,
  onLinkPosition,
  onCandidateMove,
  onConvertToEmployee,
  onArchive,
  onDelete,
  onUnlinkCandidate,
  onImportCandidates: _onImportCandidates,
  canDelete = false,
  columnLimits,
  columnTotals,
  onLoadMore,
  isLoadingMore,
}: CandidateBoardProps) {
  const grouped = useMemo(() => {
    const map = new Map<CandidateStage, Candidate[]>();
    STAGE_ORDER.forEach((stage) => map.set(stage, []));
    
    // Debug: Log all candidate stages
    const stageValues = new Set(candidates.map(c => c.stage));
    if (stageValues.size > 0) {
      console.log('Candidate stages found:', Array.from(stageValues));
      console.log('Expected stages:', STAGE_ORDER);
    }
    
    candidates.forEach((candidate) => {
      // Handle both exact matches and case-insensitive matching
      const candidateStage = candidate.stage as string;
      const candidateStageStr = String(candidateStage);
      
      // Try exact match first
      if (map.has(candidateStageStr as CandidateStage)) {
        map.get(candidateStageStr as CandidateStage)?.push(candidate);
        return;
      }
      
      // Try case-insensitive match
      const matchedStage = STAGE_ORDER.find(
        (s) => String(s).toLowerCase() === candidateStageStr.toLowerCase()
      );
      if (matchedStage) {
        map.get(matchedStage)?.push(candidate);
        return;
      }
      
      // If still no match, log and add to first stage as fallback
      console.warn(`Unknown candidate stage: "${candidateStage}" (type: ${typeof candidateStage}) for candidate ${candidate.id} - ${candidate.firstName} ${candidate.lastName}`);
      map.get(STAGE_ORDER[0])?.push(candidate);
    });
    
    // Debug: Log grouped counts
    const groupedCounts: Record<string, number> = {};
    map.forEach((candidates, stage) => {
      groupedCounts[stage] = candidates.length;
    });
    console.log('Grouped candidates by stage:', groupedCounts);
    
    return map;
  }, [candidates]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const destinationStage = destination.droppableId as CandidateStage;

    const candidate = candidates.find((item) => item.id === draggableId);
    if (!candidate) {
      return;
    }

    onCandidateMove?.(result, candidate);

    if (candidate.stage === destinationStage) {
      return;
    }

    if (!onCandidateMove) {
      onMoveStage?.(candidate, destinationStage);
    }
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="inline-flex min-w-full gap-4">
            {STAGE_ORDER.map((stage) => {
              const items = grouped.get(stage) ?? [];
              const total = columnTotals?.[stage] ?? items.length;
              const limit = columnLimits?.[stage] ?? items.length;
              const hasMore = total > limit;
              const isColumnLoading = isLoadingMore?.[stage] ?? false;
              
              return (
                <Droppable droppableId={stage} key={stage}>
                  {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex h-full min-w-[320px] max-w-[320px] flex-col rounded-xl border border-border bg-muted shadow-sm transition ${
                        snapshot.isDraggingOver ? 'border-blue-300 bg-blue-50/60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STAGE_COLORS[stage]}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {items.length} {items.length === 1 ? 'candidate' : 'candidates'}
                          {total > items.length && ` / ${total}`}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                        {isLoading && items.length === 0 ? (
                          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                              Loading candidates...
                            </div>
                          </div>
                        ) : items.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center text-sm text-muted-foreground">
                            No candidates in this stage yet.
                          </div>
                        ) : null}

                        {items.map((candidate, index) => (
                          <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                            {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={{
                                  width: '100%',
                                  ...(dragProvided.draggableProps.style ?? {}),
                                }}
                                className={`space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm transition ${
                                  dragSnapshot.isDragging ? 'border-blue-300 shadow-lg' : 'hover:shadow-md'
                                }`}
                              >
                                <CandidateCard
                                  candidate={candidate}
                                  onView={onView}
                                  onEdit={onEdit}
                                  onMoveStage={onMoveStage}
                                  onLinkPosition={onLinkPosition}
                                  onConvertToEmployee={onConvertToEmployee}
                                  onArchive={onArchive}
                                  onDelete={onDelete}
                                  onUnlinkCandidate={onUnlinkCandidate}
                                  canDelete={canDelete}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {hasMore && onLoadMore && (
                          <button
                            onClick={() => onLoadMore(stage)}
                            disabled={isColumnLoading}
                            className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isColumnLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                                Loading...
                              </span>
                            ) : (
                              `Load more (${total - limit} remaining)`
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}

interface CandidateCardProps {
  candidate: Candidate;
  onView?: (candidate: Candidate) => void;
  onEdit?: (candidate: Candidate) => void;
  onMoveStage?: (candidate: Candidate, stage: CandidateStage) => void;
  onLinkPosition?: (candidate: Candidate) => void;
  onConvertToEmployee?: (candidate: Candidate) => void;
  onArchive?: (candidate: Candidate) => void;
  onDelete?: (candidate: Candidate) => void;
  onUnlinkCandidate?: (candidate: Candidate) => void;
  canDelete?: boolean;
}

function CandidateCard({
  candidate,
  onView,
  onEdit,
  onMoveStage,
  onLinkPosition,
  onConvertToEmployee,
  onArchive,
  onDelete,
  onUnlinkCandidate,
  canDelete = false,
}: CandidateCardProps) {
  const nextStages = STAGE_ORDER.filter((stage) => stage !== candidate.stage);
  const [isExpanded, setIsExpanded] = useState(false);
  const previewSkills = (candidate.skills ?? []).slice(0, 2);
  const remainingSkills = Math.max((candidate.skills?.length ?? 0) - previewSkills.length, 0);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div
      className="space-y-3"
      role="button"
      tabIndex={0}
      onClick={toggleExpanded}
      onKeyDown={handleCardKeyDown}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground">
            {candidate.firstName} {candidate.lastName}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {candidate.currentTitle || 'Title pending'}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleExpanded();
          }}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
          aria-label={isExpanded ? 'Collapse candidate details' : 'Expand candidate details'}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {!isExpanded && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <a href={`mailto:${candidate.email}`} className="hover:underline">
              {candidate.email}
            </a>
          </span>
          {candidate.recruiter ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
              <UserRound className="h-3 w-3" />
              {candidate.recruiter.firstName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 font-medium text-muted-foreground">
              <UserRound className="h-3 w-3" />
              Unassigned
            </span>
          )}
          {previewSkills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-muted/70 px-2 py-0.5 font-medium uppercase tracking-wide"
            >
              {skill}
            </span>
          ))}
          {remainingSkills > 0 && (
            <span className="rounded-full bg-muted/70 px-2 py-0.5 font-medium text-muted-foreground">
              +{remainingSkills} more
            </span>
          )}
        </div>
      )}

      {isExpanded && (
        <>
          <div className="flex flex-wrap gap-2">
            {(candidate.skills ?? []).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${candidate.email}`} className="truncate hover:underline">
                {candidate.email}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recruiter
              </span>
              {candidate.recruiter ? (
                <div className="flex flex-col text-sm text-foreground">
                  <span className="font-medium">
                    {candidate.recruiter.firstName} {candidate.recruiter.lastName}
                  </span>
                  <a
                    href={`mailto:${candidate.recruiter.email}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {candidate.recruiter.email}
                  </a>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not assigned</span>
              )}
            </div>
            {candidate.phone && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">📞</span>
                <span>{candidate.phone}</span>
              </div>
            )}
            {candidate.expectedSalary !== undefined && candidate.expectedSalary !== null && (
              <div className="text-xs text-muted-foreground">
                Expected Salary:{' '}
                <span className="font-medium text-muted-foreground">
                  {candidate.salaryCurrency ?? 'USD'} {candidate.expectedSalary.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onView && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(candidate);
                }}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
              >
                View
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(candidate);
                }}
                className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
              >
                Edit
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {onLinkPosition && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onLinkPosition(candidate);
                }}
                className="w-full rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
              >
                Link to Position
              </button>
            )}

            {onConvertToEmployee && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onConvertToEmployee(candidate);
                }}
                className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={Boolean(candidate.employee)}
              >
                {candidate.employee ? 'Already an Employee' : 'Convert to Employee'}
              </button>
            )}

            {onMoveStage && (
              <select
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const nextStage = event.target.value as CandidateStage;
                  if (nextStage) {
                    onMoveStage(candidate, nextStage);
                    event.currentTarget.selectedIndex = 0;
                  }
                }}
                defaultValue=""
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Move to stage...</option>
                {nextStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            )}

            {onUnlinkCandidate && candidate.positions && candidate.positions.length > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUnlinkCandidate(candidate);
                }}
                className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-600 transition hover:bg-orange-100"
              >
                Unlink from Positions
              </button>
            )}
            {onUnlinkCandidate && (!candidate.positions || candidate.positions.length === 0) && (
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-semibold text-muted-foreground"
              >
                No Linked Positions
              </button>
            )}

            {onArchive && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive(candidate);
                }}
                className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-600 transition hover:bg-amber-100"
              >
                <Archive className="mr-2 inline h-4 w-4" />
                Archive
              </button>
            )}

            {canDelete && onDelete && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(candidate);
                }}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                <Trash2 className="mr-2 inline h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const CANDIDATE_STAGE_ORDER = STAGE_ORDER;
export const CANDIDATE_STAGE_LABELS = STAGE_LABELS;
export const CANDIDATE_STAGE_COLORS = STAGE_COLORS;


