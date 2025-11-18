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
  | 'REMOTE_WORK_WINDOW_OPENED';

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
  | 'raw_html';

interface TemplateBlockBase {
  id: string;
  type: TemplateBlockType;
}

export interface TemplateHeadingBlock extends TemplateBlockBase {
  type: 'heading';
  text: string;
  level: 'h1' | 'h2' | 'h3';
  align: 'left' | 'center' | 'right';
}

export interface TemplateTextBlock extends TemplateBlockBase {
  type: 'text';
  text: string;
  align: 'left' | 'center' | 'right';
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

export type TemplateBlock =
  | TemplateHeadingBlock
  | TemplateTextBlock
  | TemplateButtonBlock
  | TemplateImageBlock
  | TemplateDividerBlock
  | TemplateSpacerBlock
  | TemplateRawHtmlBlock;



