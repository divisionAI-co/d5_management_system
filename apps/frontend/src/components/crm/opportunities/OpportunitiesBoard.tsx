import { useState } from 'react';
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
import { ChevronDown, Edit, Loader2, Lock, Trash2, Trophy } from 'lucide-react';

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
  onView?: (opportunity: Opportunity) => void;
  // Per-column pagination
  columnLimits?: Record<string, number>;
  columnTotals?: Record<string, number>;
  onLoadMore?: (stage: string) => void;
  isLoadingMore?: Record<string, boolean>;
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
  onView,
  columnLimits,
  columnTotals,
  onLoadMore,
  isLoadingMore,
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

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

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

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
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
          <div className="overflow-x-auto pb-4">
            <div className="inline-flex min-w-full gap-4">
              {stages.map((stage) => {
                const key = stageKey(stage);
                const columnItems = itemsByStage[key] ?? [];
                const total = columnTotals?.[key] ?? columnItems.length;
                const limit = columnLimits?.[key] ?? columnItems.length;
                const hasMore = total > limit;
                const isColumnLoading = isLoadingMore?.[key] ?? false;
                
                return (
                  <Droppable droppableId={key} key={key}>
                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex min-h-[320px] min-w-[320px] max-w-[320px] flex-col rounded-xl border border-border bg-muted transition ${
                          snapshot.isDraggingOver ? 'border-blue-300 bg-blue-50/60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                              {stage}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {columnItems.length} deal(s)
                              {total > columnItems.length && ` / ${total}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                          {columnItems.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
                              Drop opportunities here
                            </div>
                          ) : null}
                          {columnItems.map((opportunity, index) => (
                          <Draggable key={opportunity.id} draggableId={opportunity.id} index={index}>
                            {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => {
                              const isExpanded = expandedCards[opportunity.id] ?? false;
                              const customerLabel =
                                opportunity.customer?.name ?? `Lead: ${opportunity.lead.title}`;
                              const valueLabel =
                                opportunity.value !== null
                                  ? VALUE_FORMATTER.format(opportunity.value)
                                  : 'TBD';
                              const ownerLabel = opportunity.assignedTo
                                ? `${opportunity.assignedTo.firstName} ${opportunity.assignedTo.lastName}`
                                : 'Unassigned';

                              return (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    width: '100%',
                                    ...(dragProvided.draggableProps.style ?? {}),
                                  }}
                                  className={`rounded-lg border border-border bg-card p-4 shadow-sm transition ${
                                    dragSnapshot.isDragging ? 'border-blue-300 shadow-lg' : 'hover:shadow-md'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <h4 className="truncate text-sm font-semibold text-foreground">
                                        {opportunity.title}
                                      </h4>
                                      <p className="mt-1 truncate text-xs text-muted-foreground">
                                        {customerLabel}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground">
                                        <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 font-semibold uppercase tracking-wide text-muted-foreground">
                                          {opportunity.type === 'STAFF_AUGMENTATION'
                                            ? 'Staff Aug'
                                            : opportunity.type === 'SOFTWARE_SUBSCRIPTION'
                                            ? 'SaaS'
                                            : 'Hybrid'}
                                        </span>
                                        <span>
                                          Updated {new Date(opportunity.updatedAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleCardExpansion(opportunity.id)}
                                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
                                      aria-label={isExpanded ? 'Collapse opportunity details' : 'Expand opportunity details'}
                                    >
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform ${
                                          isExpanded ? 'rotate-180' : ''
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  {isExpanded ? (
                                    <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                                      <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-muted-foreground">Value</span>
                                          <span className="font-semibold text-foreground">{valueLabel}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-muted-foreground">Owner</span>
                                          <span className="text-foreground">{ownerLabel}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                          <span>
                                            Created {new Date(opportunity.createdAt).toLocaleDateString()}
                                          </span>
                                          <span>
                                            Updated {new Date(opportunity.updatedAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        {onView ? (
                                          <button
                                            onClick={() => onView(opportunity)}
                                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                          >
                                            View
                                          </button>
                                        ) : null}
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
                                        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-600">
                                          {opportunity.isWon ? (
                                            <Trophy className="h-3 w-3" />
                                          ) : (
                                            <Lock className="h-3 w-3" />
                                          )}
                                          {opportunity.isWon ? 'Won' : 'Lost'}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">Value: {valueLabel}</span>
                                      <span>Owner: {ownerLabel}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {hasMore && onLoadMore && (
                            <button
                              onClick={() => onLoadMore(key)}
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
      )}
    </div>
  );
}


