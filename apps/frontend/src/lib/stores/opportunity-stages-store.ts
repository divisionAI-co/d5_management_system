import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OPPORTUNITY_STAGES } from '@/constants/opportunities';

interface OpportunityStagesStore {
  stages: string[];
  addStage: (stage: string) => void;
  registerStages: (stages: string[]) => void;
  resetStages: () => void;
  removeStage: (stage: string) => void;
  moveStage: (stage: string, direction: 'left' | 'right') => void;
}

const normalizeStage = (stage: string) => stage.trim();

export const useOpportunityStagesStore = create<OpportunityStagesStore>()(
  persist(
    (set) => ({
      stages: [...OPPORTUNITY_STAGES],
      addStage: (stageName) => {
        const normalized = normalizeStage(stageName);
        if (!normalized) {
          return;
        }

        set((state) => {
          const exists = state.stages.some(
            (stage) => stage.toLowerCase() === normalized.toLowerCase(),
          );
          if (exists) {
            return state;
          }
          return {
            stages: [...state.stages, normalized],
          };
        });
      },
      registerStages: (incomingStages) => {
        if (!incomingStages?.length) {
          return;
        }
        const normalizedList = incomingStages
          .map((stage) => (stage ? normalizeStage(stage) : ''))
          .filter((stage): stage is string => Boolean(stage));
        if (!normalizedList.length) {
          return;
        }

        set((state) => {
          const nextStages = [...state.stages];
          normalizedList.forEach((stage) => {
            if (
              !nextStages.some(
                (existing) => existing.toLowerCase() === stage.toLowerCase(),
              )
            ) {
              nextStages.push(stage);
            }
          });
          return {
            stages: nextStages,
          };
        });
      },
      resetStages: () => set({ stages: [...OPPORTUNITY_STAGES] }),
      removeStage: (stageName) => {
        const normalized = normalizeStage(stageName);
        if (!normalized) {
          return;
        }
        set((state) => ({
          stages: state.stages.filter(
            (stage) => stage.toLowerCase() !== normalized.toLowerCase(),
          ),
        }));
      },
      moveStage: (stageName, direction) => {
        set((state) => {
          const index = state.stages.findIndex(
            (stage) => stage.toLowerCase() === stageName.toLowerCase(),
          );
          if (index === -1) {
            return state;
          }
          const targetIndex = direction === 'left' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= state.stages.length) {
            return state;
          }
          const nextStages = [...state.stages];
          const [removed] = nextStages.splice(index, 1);
          nextStages.splice(targetIndex, 0, removed);
          return { stages: nextStages };
        });
      },
    }),
    {
      name: 'crm-opportunity-stages',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);


