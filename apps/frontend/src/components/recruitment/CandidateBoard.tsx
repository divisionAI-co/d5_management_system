import { useMemo } from 'react';
import { MoveRight, Plus, UserRound } from 'lucide-react';
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
  CandidateStage.CONTRACT_SIGNING,
  CandidateStage.HIRED,
  CandidateStage.REJECTED,
];

const STAGE_LABELS: Record<CandidateStage, string> = {
  [CandidateStage.VALIDATION]: 'Validation',
  [CandidateStage.CULTURAL_INTERVIEW]: 'Cultural Interview',
  [CandidateStage.TECHNICAL_INTERVIEW]: 'Technical Interview',
  [CandidateStage.CUSTOMER_INTERVIEW]: 'Customer Interview',
  [CandidateStage.CONTRACT_SIGNING]: 'Contract Signing',
  [CandidateStage.HIRED]: 'Hired',
  [CandidateStage.REJECTED]: 'Rejected',
};

const STAGE_COLORS: Record<CandidateStage, string> = {
  [CandidateStage.VALIDATION]: 'bg-blue-100 text-blue-700',
  [CandidateStage.CULTURAL_INTERVIEW]: 'bg-purple-100 text-purple-700',
  [CandidateStage.TECHNICAL_INTERVIEW]: 'bg-amber-100 text-amber-700',
  [CandidateStage.CUSTOMER_INTERVIEW]: 'bg-cyan-100 text-cyan-700',
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
}

export function CandidateBoard({
  candidates,
  isLoading,
  onCreateCandidate,
  onRefresh,
  onView,
  onEdit,
  onMoveStage,
  onLinkPosition,
  onCandidateMove,
  onConvertToEmployee,
}: CandidateBoardProps) {
  const grouped = useMemo(() => {
    const map = new Map<CandidateStage, Candidate[]>();
    STAGE_ORDER.forEach((stage) => map.set(stage, []));
    candidates.forEach((candidate) => {
      map.get(candidate.stage)?.push(candidate);
    });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recruitment Board</h1>
          <p className="text-sm text-muted-foreground">
            Track candidates as they progress from screening to contract
            signing. Use the actions on each card to advance stages, update
            details or link to open positions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition"
            >
              <MoveRight className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
              Refresh
            </button>
          )}
          {onCreateCandidate && (
            <button
              onClick={onCreateCandidate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-60"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4" />
              New Candidate
            </button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {STAGE_ORDER.map((stage) => {
            const items = grouped.get(stage) ?? [];
            return (
              <Droppable droppableId={stage} key={stage}>
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex h-full flex-col rounded-xl border border-border bg-muted shadow-sm transition ${
                      snapshot.isDraggingOver ? 'border-blue-300 bg-blue-50/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STAGE_COLORS[stage]}`}>
                        {STAGE_LABELS[stage]}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {items.length} {items.length === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
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
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
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
}

function CandidateCard({
  candidate,
  onView,
  onEdit,
  onMoveStage,
  onLinkPosition,
  onConvertToEmployee,
}: CandidateCardProps) {
  const nextStages = STAGE_ORDER.filter((stage) => stage !== candidate.stage);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {candidate.firstName} {candidate.lastName}
          </h3>
          <p className="text-sm text-muted-foreground">{candidate.currentTitle || 'Title pending'}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {candidate.yearsOfExperience !== undefined && candidate.yearsOfExperience !== null && (
            <span>{candidate.yearsOfExperience} yrs exp</span>
          )}
          {candidate.rating && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700">
              ★ {candidate.rating}/5
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(candidate.skills ?? []).slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {skill}
          </span>
        ))}
        {(candidate.skills?.length ?? 0) > 4 && (
          <span className="rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            +{(candidate.skills?.length ?? 0) - 4} more
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <a href={`mailto:${candidate.email}`} className="truncate hover:underline">
            {candidate.email}
          </a>
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
              {candidate.salaryCurrency ?? 'USD'}{' '}
              {candidate.expectedSalary.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onView && (
          <button
            onClick={() => onView(candidate)}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            View
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(candidate)}
            className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {onLinkPosition && (
          <button
            onClick={() => onLinkPosition(candidate)}
            className="w-full rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
          >
            Link to Position
          </button>
        )}

        {onConvertToEmployee && (
          <button
            onClick={() => onConvertToEmployee(candidate)}
            className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(candidate.employee)}
          >
            {candidate.employee ? 'Already an Employee' : 'Convert to Employee'}
          </button>
        )}

        {onMoveStage && (
          <select
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
      </div>
    </div>
  );
}

export {
  STAGE_ORDER as CANDIDATE_STAGE_ORDER,
  STAGE_LABELS as CANDIDATE_STAGE_LABELS,
  STAGE_COLORS as CANDIDATE_STAGE_COLORS,
};


