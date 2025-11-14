export const OPPORTUNITY_STAGES = [
  'New/Responsive',
  'In Talks / Meeting',
  'Offer Sent',
  'Team Building (Recruiting)',
  'Closed + Won',
  'Closed + Lost',
  'Unqualified',
] as const;

export const DEFAULT_OPPORTUNITY_STAGE = OPPORTUNITY_STAGES[0];

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];


