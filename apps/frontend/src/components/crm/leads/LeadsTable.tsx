import type { Lead } from '@/types/crm';
import { format } from 'date-fns';
import { ClipboardList, Edit3, RefreshCcw, Star, Trash2, UserPlus } from 'lucide-react';
import clsx from 'clsx';

interface LeadsTableProps {
  leads?: Lead[];
  isLoading: boolean;
  onCreate?: () => void;
  onEdit: (lead: Lead) => void;
  onUpdateStatus: (lead: Lead) => void;
  onConvert: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-indigo-100 text-indigo-700',
  QUALIFIED: 'bg-emerald-100 text-emerald-700',
  PROPOSAL: 'bg-amber-100 text-amber-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
};

export function LeadsTable({
  leads,
  isLoading,
  onCreate,
  onEdit,
  onUpdateStatus,
  onConvert,
  onDelete,
}: LeadsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <ClipboardList className="h-10 w-10 text-gray-400" />
          <p>No leads found. Try adjusting your filters or create a new lead.</p>
          {onCreate && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              New Lead
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
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Lead</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Company</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Probability</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Value</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Assigned</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {leads.map((lead) => (
            <tr key={lead.id} className="transition hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">
                <div className="font-semibold text-gray-900">{lead.title}</div>
                {lead.source && <div className="text-xs text-gray-500">Source: {lead.source}</div>}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                <div className="font-medium text-gray-900">
                  {lead.contact.firstName} {lead.contact.lastName}
                </div>
                <div className="text-xs text-gray-500">{lead.contact.email}</div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {lead.contact.companyName || lead.prospectCompanyName || '—'}
              </td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={clsx(
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                    statusColors[lead.status] ?? 'bg-gray-100 text-gray-700',
                  )}
                >
                  {lead.status}
                </span>
                {lead.convertedCustomer && (
                  <div className="mt-1 text-xs text-emerald-600">Converted → {lead.convertedCustomer.name}</div>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {lead.probability !== null && lead.probability !== undefined ? `${lead.probability}%` : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {lead.value !== null && lead.value !== undefined ? lead.value.toLocaleString() : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {lead.assignedTo
                  ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
                  : 'Unassigned'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {format(new Date(lead.updatedAt), 'MMM dd, yyyy')}
              </td>
              <td className="px-6 py-4 text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-blue-200 hover:text-blue-600"
                    title="Edit lead"
                    onClick={() => onEdit(lead)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-indigo-200 hover:text-indigo-600"
                    title="Update status"
                    onClick={() => onUpdateStatus(lead)}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Convert lead"
                    onClick={() => onConvert(lead)}
                    disabled={!!lead.convertedCustomerId}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-200 hover:text-red-600"
                    title="Delete lead"
                    onClick={() => onDelete(lead)}
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
