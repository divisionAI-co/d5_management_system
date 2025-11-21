import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, leadsApi } from '@/lib/api/crm';
import type { CustomerSummary, Lead, LeadFilters, LeadStatus, LeadsListResponse } from '@/types/crm';
import { LeadsTable } from '@/components/crm/leads/LeadsTable';
import { LeadForm } from '@/components/crm/leads/LeadForm';
import { LeadStatusForm } from '@/components/crm/leads/LeadStatusForm';
import { LeadConvertModal } from '@/components/crm/leads/LeadConvertModal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { LeadsImportDialog } from '@/components/crm/leads/LeadsImportDialog';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Filter, Plus, UploadCloud } from 'lucide-react';

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
  const navigate = useNavigate();

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
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<Lead | null>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [showFilters, setShowFilters] = useState(false);

  const leadsQuery = useQuery<LeadsListResponse>({
    queryKey: ['leads', filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'lead-import-options'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
    enabled: isAdmin,
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
    setDeleteConfirmLead(lead);
  };

  const confirmDelete = () => {
    if (deleteConfirmLead) {
      deleteMutation.mutate(deleteConfirmLead.id);
      setDeleteConfirmLead(null);
    }
  };

  const handleView = (lead: Lead) => {
    navigate(`/crm/leads/${lead.id}`);
  };

  const meta = leadsQuery.data?.meta;
  const leads = leadsQuery.data?.data ?? [];
  const customers = (customersQuery.data?.data ?? []) as CustomerSummary[];
  const canImport = isAdmin;

  const paginationInfo = useMemo(() => {
    if (!meta) return '0 leads';
    const start = (meta.page - 1) * meta.pageSize + 1;
    const end = Math.min(meta.page * meta.pageSize, meta.total);
    return `${start}-${end} of ${meta.total}`;
  }, [meta]);

  return (
    <div className="space-y-6 py-8 text-foreground">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Track prospects across the lifecycle and convert them to paying customers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canImport && (
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground"
            >
              <UploadCloud className="h-4 w-4" />
              Import Leads
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Lead
          </button>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, contact or company"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Advanced filters
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Status
                </label>
                <select
                  value={filters.status ?? ''}
                  onChange={(event) => handleStatusChange(event.target.value ? (event.target.value as LeadStatus) : undefined)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Sort By
                </label>
                <select
                  value={filters.sortBy ?? 'createdAt'}
                  onChange={(event) => handleSortChange(event.target.value as LeadFilters['sortBy'])}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Direction
                </label>
                <button
                  type="button"
                  onClick={handleSortOrderToggle}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground"
                >
                  {filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border pt-3">
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
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{paginationInfo}</span>
        {meta && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page === 1}
              className="rounded-lg border border-border px-3 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page <span className="font-semibold text-foreground">{meta.page}</span> of{' '}
              <span className="font-semibold text-foreground">{meta.pageCount || 1}</span>
            </span>
            <button
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= (meta.pageCount || 1)}
              className="rounded-lg border border-border px-3 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
        onView={handleView}
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

      <LeadsImportDialog
        open={importOpen}
        customers={customers}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmationDialog
        open={!!deleteConfirmLead}
        title="Delete Lead"
        message={`Are you sure you want to delete "${deleteConfirmLead?.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmLead(null)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
