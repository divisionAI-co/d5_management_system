export type TemplateType =
  | 'INVOICE'
  | 'CUSTOMER_REPORT'
  | 'PERFORMANCE_REVIEW'
  | 'FEEDBACK_REPORT'
  | 'EMAIL'
  | 'EOD_REPORT_SUBMITTED'
  | 'LEAVE_REQUEST_CREATED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'TASK_ASSIGNED'
  | 'MENTION_NOTIFICATION'
  | 'REMOTE_WORK_WINDOW_OPENED'
  | 'QUOTE';

export interface TemplateVariable {
  key: string;
  description?: string | null;
  sampleValue?: unknown;
}

export interface TemplateModel {
  id: string;
  name: string;
  type: TemplateType;
  htmlContent: string;
  cssContent?: string | null;
  variables: TemplateVariable[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFilters {
  type?: TemplateType;
  onlyActive?: boolean;
  search?: string;
}

export interface CreateTemplatePayload {
  name: string;
  type: TemplateType;
  htmlContent: string;
  cssContent?: string;
  variables: TemplateVariable[];
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateTemplatePayload extends Partial<CreateTemplatePayload> {}

export interface TemplatePreviewPayload {
  data?: Record<string, unknown>;
}

export interface TemplatePreviewResponse {
  templateId: string;
  type: TemplateType;
  renderedHtml: string;
  variables: TemplateVariable[];
}

export type TemplateBlockType =
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'divider'
  | 'spacer'
  | 'raw_html'
  | 'row';

interface TemplateBlockBase {
  id: string;
  type: TemplateBlockType;
  customStyle?: string; // Custom inline CSS styles for this block
  stackOnBlockId?: string; // ID of another block to stack on top of (for layering)
}

export interface TemplateHeadingBlock extends TemplateBlockBase {
  type: 'heading';
  text: string;
  level: 'h1' | 'h2' | 'h3';
  align: 'left' | 'center' | 'right';
  fontFamily?: string; // Font family for the heading (e.g., 'Arial', 'Georgia', 'Times New Roman')
}

export interface TemplateTextBlock extends TemplateBlockBase {
  type: 'text';
  text: string;
  align: 'left' | 'center' | 'right';
  fontFamily?: string; // Font family for the text (e.g., 'Arial', 'Georgia', 'Times New Roman')
}

export interface TemplateButtonBlock extends TemplateBlockBase {
  type: 'button';
  label: string;
  url: string;
  align: 'left' | 'center' | 'right';
  backgroundColor: string;
  textColor: string;
}

export interface TemplateImageBlock extends TemplateBlockBase {
  type: 'image';
  url: string;
  altText: string;
  width: number;
  align: 'left' | 'center' | 'right';
  fullWidth?: boolean; // If true, image spans full viewport width
  position?: 'top' | 'bottom' | 'inline'; // Position for all images: top (always top), bottom (always bottom), inline (respect block order)
  overlayText?: string;
  overlayPosition?: 'top' | 'center' | 'bottom';
  overlayTextColor?: string;
  overlayBackgroundColor?: string;
  overlayBackgroundOpacity?: number; // 0-100
}

export interface TemplateDividerBlock extends TemplateBlockBase {
  type: 'divider';
  thickness: number;
  color: string;
}

export interface TemplateSpacerBlock extends TemplateBlockBase {
  type: 'spacer';
  height: number;
}

export interface TemplateRawHtmlBlock extends TemplateBlockBase {
  type: 'raw_html';
  html: string;
}

export interface TemplateRowBlock extends TemplateBlockBase {
  type: 'row';
  leftBlocks: TemplateBlock[];
  rightBlocks: TemplateBlock[];
  leftWidth?: number; // Percentage (0-100), defaults to 50
  rightWidth?: number; // Percentage (0-100), defaults to 50
  gap?: number; // Gap between columns in pixels, defaults to 24
}

export type TemplateBlock =
  | TemplateHeadingBlock
  | TemplateTextBlock
  | TemplateButtonBlock
  | TemplateImageBlock
  | TemplateDividerBlock
  | TemplateSpacerBlock
  | TemplateRawHtmlBlock
  | TemplateRowBlock;



