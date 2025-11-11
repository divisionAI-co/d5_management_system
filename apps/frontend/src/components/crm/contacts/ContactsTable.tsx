import type { ContactSummary } from '@/types/crm';
import { format } from 'date-fns';
import { ClipboardList, Edit3, Mail, Phone, Trash2, UserPlus } from 'lucide-react';

interface ContactsTableProps {
  contacts?: ContactSummary[];
  isLoading: boolean;
  onCreate?: () => void;
  onEdit: (contact: ContactSummary) => void;
  onDelete: (contact: ContactSummary) => void;
  onSelect?: (contact: ContactSummary) => void;
}

export function ContactsTable({
  contacts,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
  onSelect,
}: ContactsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <ClipboardList className="h-10 w-10 text-gray-400" />
          <p>No contacts found. Try adjusting filters or create a new contact.</p>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              New Contact
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Company</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Leads</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {contacts.map((contact) => (
            <tr key={contact.id} className="transition hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
                      <div className="mt-1 text-xs uppercase tracking-wide text-blue-600">
                        {contact.role}
                      </div>
                    )}
                  </div>
                  {onSelect && (
                    <button
                      type="button"
                      onClick={() => onSelect(contact)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                      View
                    </button>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {contact.companyName || '—'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {contact.customer ? (
                  <div>
                    <div className="font-medium text-gray-900">{contact.customer.name}</div>
                    {contact.customer.email && (
                      <div className="text-xs text-gray-500">{contact.customer.email}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Unassigned</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                <div className="text-sm font-semibold text-gray-900">
                  {contact._count?.leads ?? 0}
                </div>
                <div className="text-xs text-gray-500">Activities: {contact._count?.activities ?? 0}</div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {format(new Date(contact.updatedAt), 'MMM dd, yyyy')}
              </td>
              <td className="px-6 py-4 text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(contact)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-blue-200 hover:text-blue-600"
                    title="Edit contact"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(contact)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-200 hover:text-red-600"
                    title="Delete contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
