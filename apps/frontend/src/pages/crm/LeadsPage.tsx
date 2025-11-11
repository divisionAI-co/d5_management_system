import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm';
import type { Lead, LeadFilters, LeadStatus, LeadsListResponse } from '@/types/crm';
import { LeadsTable } from '@/components/crm/leads/LeadsTable';
import { LeadForm } from '@/components/crm/leads/LeadForm';
import { LeadStatusForm } from '@/components/crm/leads/LeadStatusForm';
import { LeadConvertModal } from '@/components/crm/leads/LeadConvertModal';
import { Filter, Plus } from 'lucide-react';

const STATUS_FILTER_OPTIONS: Array<{ label: string; value?: LeadStatus }> = [
  { label: 'All statuses', value: undefined },
  { label: 'New', value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Qualified', value: 'QUALIFIED' },
  { label: 'Proposal', value: 'PROPOSAL' },
  { label: 'Won', value: 'WON' },
  { label: 'Lost', value: 'LOST' },
];

const SORT_OPTIONS: Array<{ label: string; value: LeadFilters['sortBy'] }> = [
  { label: 'Created', value: 'createdAt' },
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Probability', value: 'probability' },
  { label: 'Value', value: 'value' },
];

export default function LeadsPage() {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<LeadFilters>({
    page: 1,
    pageSize: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();
  const [statusLead, setStatusLead] = useState<Lead | undefined>();
  const [convertLead, setConvertLead] = useState<Lead | undefined>();

  const leadsQuery = useQuery<LeadsListResponse>({
    queryKey: ['leads', filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handleStatusChange = (value?: LeadStatus) => {
    setFilters((prev) => ({ ...prev, status: value, page: 1 }));
  };

  const handleSortChange = (value: LeadFilters['sortBy']) => {
    setFilters((prev) => ({ ...prev, sortBy: value, page: 1 }));
  };

  const handleSortOrderToggle = () => {
    setFilters((prev) => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleOpenCreate = () => {
    setEditingLead(undefined);
    setFormOpen(true);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const handleStatusUpdate = (lead: Lead) => {
    setStatusLead(lead);
  };

  const handleConvert = (lead: Lead) => {
    setConvertLead(lead);
  };

  const handleDelete = (lead: Lead) => {
    if (window.confirm(`Delete lead "${lead.title}"?`)) {
      deleteMutation.mutate(lead.id);
    }
  };

  const meta = leadsQuery.data?.meta;
  const leads = leadsQuery.data?.data ?? [];

  const paginationInfo = useMemo(() => {
    if (!meta) return '0 leads';
    const start = (meta.page - 1) * meta.pageSize + 1;
    const end = Math.min(meta.page * meta.pageSize, meta.total);
    return `${start}-${end} of ${meta.total}`;
  }, [meta]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-600">
            Track prospects across the lifecycle and convert them to paying customers.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Lead
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, contact or company"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Status</label>
            <select
              value={filters.status ?? ''}
              onChange={(event) => handleStatusChange(event.target.value ? (event.target.value as LeadStatus) : undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.label} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Sort By</label>
              <select
                value={filters.sortBy ?? 'createdAt'}
                onChange={(event) => handleSortChange(event.target.value as LeadFilters['sortBy'])}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Direction</label>
              <button
                type="button"
                onClick={handleSortOrderToggle}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setFilters({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' });
            }}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Reset
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{paginationInfo}</span>
        {meta && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page <span className="font-semibold text-gray-900">{meta.page}</span> of{' '}
              <span className="font-semibold text-gray-900">{meta.pageCount || 1}</span>
            </span>
            <button
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= (meta.pageCount || 1)}
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <LeadsTable
        leads={leads}
        isLoading={leadsQuery.isLoading || leadsQuery.isFetching}
        onCreate={handleOpenCreate}
        onEdit={handleEdit}
        onUpdateStatus={handleStatusUpdate}
        onConvert={handleConvert}
        onDelete={handleDelete}
      />

      {formOpen && (
        <LeadForm
          lead={editingLead}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false);
            setEditingLead(undefined);
          }}
        />
      )}

      {statusLead && (
        <LeadStatusForm
          lead={statusLead}
          onClose={() => setStatusLead(undefined)}
          onSuccess={() => {
            setStatusLead(undefined);
          }}
        />
      )}

      {convertLead && (
        <LeadConvertModal
          lead={convertLead}
          onClose={() => setConvertLead(undefined)}
          onSuccess={() => {
            setConvertLead(undefined);
          }}
        />
      )}
    </div>
  );
}
