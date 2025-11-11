import type { ContactDetail } from '@/types/crm';
import { format } from 'date-fns';
import { FileText, Mail, MapPin, Phone, UserCircle2 } from 'lucide-react';

interface ContactDetailPanelProps {
  contact: ContactDetail;
  onClose: () => void;
}

export function ContactDetailPanel({ contact, onClose }: ContactDetailPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/50">
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {contact.firstName} {contact.lastName}
            </h2>
            <p className="text-sm text-gray-500">Contact overview & recent engagement</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <UserCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">
                  {contact.firstName} {contact.lastName}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
                  <div className="text-xs text-gray-500">{contact.companyName}</div>
                )}
                <div className="text-xs text-gray-400">
                  Updated {format(new Date(contact.updatedAt), 'MMM dd, yyyy')}
                </div>
              </div>
            </div>

            {contact.customer && (
              <div className="mt-4 rounded-md border border-blue-100 bg-white p-3 text-sm text-gray-700">
                <p className="text-xs font-semibold uppercase text-blue-600">Linked Customer</p>
                <p className="text-gray-900">{contact.customer.name}</p>
                {contact.customer.email && <p className="text-xs text-gray-500">{contact.customer.email}</p>}
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
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <FileText className="h-4 w-4 text-blue-600" /> Notes
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Open Leads</div>
              <span className="text-xs text-gray-500">{contact.leads?.length ?? 0} linked</span>
            </div>
            {contact.leads && contact.leads.length > 0 ? (
              <ul className="space-y-3 text-sm text-gray-700">
                {contact.leads.map((lead) => (
                  <li key={lead.id} className="rounded-md border border-gray-100 p-3">
                    <div className="font-semibold text-gray-900">{lead.title}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span className="uppercase tracking-wide text-blue-600">{lead.status}</span>
                      {lead.value !== null && lead.value !== undefined && (
                        <span>Value: {lead.value.toLocaleString()}</span>
                      )}
                      {lead.probability !== null && lead.probability !== undefined && (
                        <span>Probability: {lead.probability}%</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Created {format(new Date(lead.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No linked leads yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Recent Activity</div>
              <span className="text-xs text-gray-500">{contact.activities?.length ?? 0} items</span>
            </div>
            {contact.activities && contact.activities.length > 0 ? (
              <ul className="space-y-3 text-sm text-gray-700">
                {contact.activities.map((activity) => (
                  <li key={activity.id} className="rounded-md border border-gray-100 p-3">
                    <div className="font-semibold text-gray-900">{activity.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span className="uppercase tracking-wide text-blue-600">{activity.type}</span>
                      <span>{format(new Date(activity.createdAt), 'MMM dd, yyyy')}</span>
                    </div>
                    {activity.description && (
                      <p className="mt-2 text-xs text-gray-600">{activity.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-gray-200 py-6 text-xs text-gray-500">
                <MapPin className="h-5 w-5 text-gray-400" />
                <p>No tracked activity yet.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
