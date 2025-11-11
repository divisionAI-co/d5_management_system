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
import type { Opportunity } from '@/types/crm';
import { Edit, Loader2, Lock, Trash2, Trophy } from 'lucide-react';

interface OpportunitiesBoardProps {
  stages: string[];
  opportunities: Opportunity[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (opportunity: Opportunity) => void;
  onClose: (opportunity: Opportunity) => void;
  onDelete: (opportunity: Opportunity) => void;
  onMove: (opportunity: Opportunity, newStage: string) => void;
  onOpportunityMove?: (result: DropResult, opportunity: Opportunity) => void;
}

const VALUE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function stageKey(stage: string) {
  return stage || 'Unspecified';
}

export function OpportunitiesBoard({
  stages,
  opportunities,
  isLoading,
  onCreate,
  onEdit,
  onClose,
  onDelete,
  onMove,
  onOpportunityMove,
}: OpportunitiesBoardProps) {
  const itemsByStage = stages.reduce<Record<string, Opportunity[]>>((acc, stage) => {
    acc[stageKey(stage)] = [];
    return acc;
  }, {});

  opportunities.forEach((opportunity) => {
    const key = stageKey(opportunity.stage);
    if (!itemsByStage[key]) {
      itemsByStage[key] = [];
    }
    itemsByStage[key].push(opportunity);
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;

    if (!destination) {
      return;
    }

    const opportunity = opportunities.find((item) => item.id === draggableId);
    if (!opportunity) {
      return;
    }

    const newStage = destination.droppableId;

    onOpportunityMove?.(result, opportunity);

    if (opportunity.stage === newStage) {
      return;
    }

    if (!onOpportunityMove) {
      onMove(opportunity, newStage);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Board</h2>
          <p className="text-xs text-muted-foreground">Drag opportunities to update their pipeline stage.</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Create Opportunity
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-border bg-card">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading opportunities...
          </span>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            {stages.map((stage) => {
              const key = stageKey(stage);
              const columnItems = itemsByStage[key] ?? [];
              return (
                <Droppable droppableId={key} key={key}>
                  {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex min-h-[320px] flex-col rounded-xl border border-border bg-muted transition ${
                        snapshot.isDraggingOver ? 'border-blue-300 bg-blue-50/60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {stage}
                          </h3>
                          <p className="text-xs text-muted-foreground">{columnItems.length} deal(s)</p>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-3">
                        {columnItems.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
                            Drop opportunities here
                          </div>
                        ) : null}
                        {columnItems.map((opportunity, index) => (
                          <Draggable key={opportunity.id} draggableId={opportunity.id} index={index}>
                            {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={{
                                  width: '100%',
                                  ...(dragProvided.draggableProps.style ?? {}),
                                }}
                                className={`rounded-lg border border-border bg-card p-4 shadow-sm transition ${
                                  dragSnapshot.isDragging ? 'border-blue-300 shadow-lg' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground">
                                      {opportunity.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      {opportunity.customer?.name ?? `Lead: ${opportunity.lead.title}`}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-muted/70 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {opportunity.type === 'STAFF_AUGMENTATION'
                                      ? 'Staff Aug'
                                      : opportunity.type === 'SOFTWARE_SUBSCRIPTION'
                                      ? 'SaaS'
                                      : 'Hybrid'}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-muted-foreground">Value</span>
                                    <span className="font-semibold text-foreground">
                                      {opportunity.value !== null
                                        ? VALUE_FORMATTER.format(opportunity.value)
                                        : 'TBD'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-muted-foreground">Owner</span>
                                    {opportunity.assignedTo ? (
                                      <span>
                                        {opportunity.assignedTo.firstName}{' '}
                                        {opportunity.assignedTo.lastName}
                                      </span>
                                    ) : (
                                      <span className="italic text-muted-foreground">Unassigned</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
                                    <span>
                                      Created {new Date(opportunity.createdAt).toLocaleDateString()}
                                    </span>
                                    <span>
                                      Updated {new Date(opportunity.updatedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    onClick={() => onEdit(opportunity)}
                                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => onClose(opportunity)}
                                    disabled={opportunity.isClosed}
                                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trophy className="h-3.5 w-3.5" />
                                    {opportunity.isClosed ? 'Closed' : 'Close'}
                                  </button>
                                  <button
                                    onClick={() => onDelete(opportunity)}
                                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </div>
                                {opportunity.isClosed ? (
                                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-600">
                                    {opportunity.isWon ? (
                                      <Trophy className="h-3 w-3" />
                                    ) : (
                                      <Lock className="h-3 w-3" />
                                    )}
                                    {opportunity.isWon ? 'Won' : 'Lost'}
                                  </div>
                                ) : null}
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
      )}
    </div>
  );
}


