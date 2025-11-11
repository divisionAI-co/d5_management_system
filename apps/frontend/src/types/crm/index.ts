import type { Activity } from '@/types/activities';

export type CustomerType = 'STAFF_AUGMENTATION' | 'SOFTWARE_SUBSCRIPTION' | 'BOTH';
export type CustomerStatus = 'ONBOARDING' | 'ACTIVE' | 'AT_RISK' | 'PAUSED' | 'CHURNED';
export type CustomerSentiment = 'HAPPY' | 'NEUTRAL' | 'UNHAPPY';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';

export interface CustomerCounts {
  contacts: number;
  opportunities: number;
  invoices: number;
  activities?: number;
  meetings?: number;
}

export interface CustomerBase {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  type: CustomerType;
  status: CustomerStatus;
  sentiment: CustomerSentiment;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  monthlyValue?: number | null;
  currency?: string | null;
  notes?: string | null;
  tags: string[];
  odooId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary extends CustomerBase {
  _count?: CustomerCounts;
}

export interface CustomerOpportunity {
  id: string;
  title: string;
  stage: string;
  type: CustomerType;
  value: number | null;
  isClosed: boolean;
  isWon: boolean;
  createdAt: string;
  updatedAt: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  total: number | null;
  status: string;
  dueDate: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  companyName?: string | null;
  customerId?: string | null;
  createdAt: string;
  updatedAt: string;
  linkedinUrl?: string | null;
  notes?: string | null;
}

export interface ContactCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface ContactLeadSummary {
  id: string;
  title: string;
  status: LeadStatus;
  value?: number | null;
  probability?: number | null;
  createdAt: string;
}

export type ContactActivitySummary = Activity;

export interface ContactSummary extends Contact {
  customer?: ContactCustomer | null;
  _count?: {
    leads: number;
    activities: number;
  };
}

export interface ContactDetail extends Contact {
  customer?: ContactCustomer | null;
  leads?: ContactLeadSummary[];
  activities?: ContactActivitySummary[];
}

export interface CustomerDetail extends CustomerSummary {
  contacts: Contact[];
  opportunities: CustomerOpportunity[];
  invoices: CustomerInvoice[];
}

export type CustomerActivity = Activity;

export interface CustomersListResponse {
  data: CustomerSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface ContactsListResponse {
  data: ContactSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface CreateCustomerPayload {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  type: CustomerType;
  status?: CustomerStatus;
  sentiment?: CustomerSentiment;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  monthlyValue?: number;
  currency?: string;
  notes?: string;
  tags?: string[];
  odooId?: string;
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {}

export interface UpdateCustomerStatusPayload {
  status?: CustomerStatus;
  sentiment?: CustomerSentiment;
  note?: string;
}

export interface CustomerFilters {
  search?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  sentiment?: CustomerSentiment;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'monthlyValue';
  sortOrder?: 'asc' | 'desc';
  country?: string;
  tags?: string[];
}

export interface ContactFilters {
  search?: string;
  customerId?: string;
  unassigned?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  companyName?: string;
  linkedinUrl?: string;
  notes?: string;
  customerId?: string;
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> {}

export interface ConvertContactToLeadPayload {
  title: string;
  description?: string;
  status?: LeadStatus;
  value?: number;
  probability?: number;
  assignedToId?: string;
  source?: string;
  expectedCloseDate?: string;
  prospectCompanyName?: string;
  prospectWebsite?: string;
  prospectIndustry?: string;
}

export interface Lead {
  id: string;
  title: string;
  description?: string | null;
  status: LeadStatus;
  value?: number | null;
  probability?: number | null;
  assignedToId?: string | null;
  source?: string | null;
  expectedCloseDate?: string | null;
  actualCloseDate?: string | null;
  lostReason?: string | null;
  prospectCompanyName?: string | null;
  prospectWebsite?: string | null;
  prospectIndustry?: string | null;
  convertedCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  convertedCustomer?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
}

export interface LeadsListResponse {
  data: Lead[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface LeadFilters {
  search?: string;
  status?: LeadStatus;
  assignedToId?: string;
  contactId?: string;
  convertedCustomerId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'probability' | 'value';
  sortOrder?: 'asc' | 'desc';
}

export interface LeadContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  companyName?: string;
  customerId?: string;
}

export interface CreateLeadPayload {
  contactId?: string;
  contact?: LeadContactPayload;
  title: string;
  description?: string;
  status?: LeadStatus;
  value?: number;
  probability?: number;
  assignedToId?: string;
  source?: string;
  expectedCloseDate?: string;
  prospectCompanyName?: string;
  prospectWebsite?: string;
  prospectIndustry?: string;
}

export interface UpdateLeadPayload extends Partial<CreateLeadPayload> {}

export interface UpdateLeadStatusPayload {
  status?: LeadStatus;
  probability?: number;
  lostReason?: string;
  actualCloseDate?: string;
}

export interface ConvertLeadPayload {
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerWebsite?: string;
  customerIndustry?: string;
  customerType: CustomerType;
  customerStatus?: CustomerStatus;
  customerSentiment?: CustomerSentiment;
  customerMonthlyValue?: number;
  customerCurrency?: string;
  customerNotes?: string;
  leadStatus?: LeadStatus;
}

export interface OpportunityAssignee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface OpportunityLead {
  id: string;
  title: string;
  status?: LeadStatus;
}

export interface OpportunityOpenPosition {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  requirements?: string | null;
  createdAt: string;
  updatedAt: string;
  filledAt?: string | null;
}

export interface OpportunityCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface OpportunityActivity {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface Opportunity {
  id: string;
  customerId?: string | null;
  leadId: string;
  assignedToId?: string | null;
  title: string;
  description?: string | null;
  type: CustomerType;
  value: number | null;
  jobDescriptionUrl?: string | null;
  stage: string;
  isClosed: boolean;
  isWon: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  customer?: OpportunityCustomer | null;
  assignedTo?: OpportunityAssignee | null;
  lead: OpportunityLead;
  openPosition?: OpportunityOpenPosition | null;
}

export interface OpportunityDetail extends Opportunity {
  activities?: OpportunityActivity[];
}

export interface OpportunitiesListResponse {
  data: Opportunity[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface OpportunityFilters {
  search?: string;
  customerId?: string;
  assignedToId?: string;
  leadId?: string;
  type?: CustomerType;
  stage?: string;
  isClosed?: boolean;
  isWon?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'value' | 'stage' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateOpportunityPayload {
  leadId: string;
  customerId?: string;
  title: string;
  description?: string;
  type: CustomerType;
  value: number;
  assignedToId?: string;
  jobDescriptionUrl?: string;
  stage?: string;
  isClosed?: boolean;
  isWon?: boolean;
  positionTitle?: string;
  positionDescription?: string;
  positionRequirements?: string;
}

export interface UpdateOpportunityPayload extends Partial<CreateOpportunityPayload> {}

export interface CloseOpportunityPayload {
  isWon: boolean;
  stage?: string;
  closedAt?: string;
}


