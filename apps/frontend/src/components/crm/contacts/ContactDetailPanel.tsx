import { useState } from 'react';
import type { ContactDetail } from '@/types/crm';
import { format } from 'date-fns';
import { FileText, Loader2, Mail, PenSquare, Phone, UserCircle2 } from 'lucide-react';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';

interface ContactDetailPanelProps {
  contact: ContactDetail;
  onClose: () => void;
  onConvertToLead: (contact: ContactDetail) => void;
  isConverting?: boolean;
}

export function ContactDetailPanel({
  contact,
  onClose,
  onConvertToLead,
  isConverting,
}: ContactDetailPanelProps) {
  const [showActivitySidebar, setShowActivitySidebar] = useState(false);
  const safeFormatDate = (value?: string | Date | null) => {
    if (!value) {
      return null;
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return format(date, 'MMM dd, yyyy');
  };

  const updatedAtLabel = safeFormatDate(contact.updatedAt);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/50">
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-foreground">
              {contact.firstName} {contact.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">Contact overview & recent engagement</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowActivitySidebar(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <PenSquare className="h-4 w-4" />
              Activities
            </button>
            <button
              type="button"
              onClick={() => onConvertToLead(contact)}
              disabled={isConverting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConverting && <Loader2 className="h-4 w-4 animate-spin" />}
              Convert to Lead
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="rounded-lg border border-border bg-muted p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <UserCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">
                  {contact.firstName} {contact.lastName}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {contact.email}
                  </span>
                  {contact.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </span>
                  )}
                </div>
                {contact.role && (
                  <div className="text-xs uppercase tracking-wide text-blue-600">{contact.role}</div>
                )}
                {contact.companyName && (
                  <div className="text-xs text-muted-foreground">{contact.companyName}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  Updated {updatedAtLabel ?? '—'}
                </div>
              </div>
            </div>

            {contact.customer && (
              <div className="mt-4 rounded-md border border-blue-100 bg-card p-3 text-sm text-muted-foreground">
                <p className="text-xs font-semibold uppercase text-blue-600">Linked Customer</p>
                <p className="text-foreground">{contact.customer.name}</p>
                {contact.customer.email && <p className="text-xs text-muted-foreground">{contact.customer.email}</p>}
              </div>
            )}

            {contact.linkedinUrl && (
              <div className="mt-3 text-xs text-blue-600">
                <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  View LinkedIn Profile
                </a>
              </div>
            )}
          </section>

          {contact.notes && (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-blue-600" /> Notes
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
            </section>
          )}

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Open Leads</div>
              <span className="text-xs text-muted-foreground">{contact.leads?.length ?? 0} linked</span>
            </div>
            {contact.leads && contact.leads.length > 0 ? (
              <ul className="space-y-3 text-sm text-muted-foreground">
                {contact.leads.map((lead) => (
                  <li key={lead.id} className="rounded-md border border-border p-3">
                    <div className="font-semibold text-foreground">{lead.title}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide text-blue-600">{lead.status}</span>
                      {lead.value !== null && lead.value !== undefined && (
                        <span>Value: {lead.value.toLocaleString()}</span>
                      )}
                      {lead.probability !== null && lead.probability !== undefined && (
                        <span>Probability: {lead.probability}%</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created {safeFormatDate(lead.createdAt) ?? '—'}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No linked leads yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
            Use the Activities button above to view or log notes for this contact.
          </section>
        </div>
      </div>
      <ActivitySidebar
        open={showActivitySidebar}
        onClose={() => setShowActivitySidebar(false)}
        entityId={contact.id}
        entityType="contact"
        title="Activity & Notes"
      />
    </div>
  );
}
