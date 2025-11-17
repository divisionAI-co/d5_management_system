export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface InvoiceCustomerSummary {
  id: string;
  name: string;
  email?: string | null;
}

export interface InvoiceUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  metadata?: Record<string, unknown>;
}

export interface InvoiceItem extends InvoiceItemInput {
  lineTotal?: number;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: InvoiceCustomerSummary | null;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string | null;
  remindersSent: number;
  lastReminderAt?: string | null;
  isRecurring: boolean;
  recurringDay?: number | null;
  createdById: string;
  createdBy?: InvoiceUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  items: InvoiceItem[];
  notes?: string | null;
  pdfUrl?: string | null;
}

export interface InvoicesListResponse {
  data: InvoiceSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export type InvoiceSortField =
  | 'issueDate'
  | 'dueDate'
  | 'total'
  | 'invoiceNumber'
  | 'createdAt'
  | 'status';

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  isRecurring?: boolean;
  overdue?: boolean;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: InvoiceSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateInvoicePayload {
  customerId: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate: string;
  currency?: string;
  taxRate?: number;
  status?: InvoiceStatus;
  notes?: string;
  items: InvoiceItemInput[];
  isRecurring?: boolean;
  recurringDay?: number;
}

export interface UpdateInvoicePayload extends Partial<CreateInvoicePayload> {
  statusNote?: string;
}

export interface SendInvoicePayload {
  to?: string[];
  cc?: string[];
  subject?: string;
  message?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface MarkInvoicePaidPayload {
  paidDate?: string;
  note?: string;
}

export interface PreviewInvoicePayload {
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface PreviewInvoiceResponse {
  invoiceId: string;
  invoiceNumber: string;
  templateId: string | null;
  renderedHtml: string;
}


