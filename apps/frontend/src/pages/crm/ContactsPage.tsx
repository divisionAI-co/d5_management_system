import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi, customersApi } from '@/lib/api/crm';
import type {
  ContactDetail,
  ContactFilters,
  ContactSummary,
  ContactsListResponse,
  CustomerSummary,
} from '@/types/crm';
import { ContactsTable } from '@/components/crm/contacts/ContactsTable';
import { ContactForm } from '@/components/crm/contacts/ContactForm';
import { ContactDetailPanel } from '@/components/crm/contacts/ContactDetailPanel';
import { ContactImportDialog } from '@/components/crm/contacts/ContactImportDialog';
import { Filter, Plus, UploadCloud } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

const SORT_OPTIONS: Array<{ label: string; value: NonNullable<ContactFilters['sortBy']> }> = [
  { label: 'Created', value: 'createdAt' },
  { label: 'Updated', value: 'updatedAt' },
  { label: 'First Name', value: 'firstName' },
  { label: 'Last Name', value: 'lastName' },
];

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ContactFilters>({
    page: 1,
    pageSize: 15,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>();
  const [showUnassigned, setShowUnassigned] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactSummary | undefined>();
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { user } = useAuthStore();

  const contactsQuery = useQuery<ContactsListResponse>({
    queryKey: ['contacts', filters],
    queryFn: () => contactsApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'contact-filter-options'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  const contactDetailQuery = useQuery<ContactDetail>({
    queryKey: ['contact', detailContactId],
    queryFn: () => contactsApi.getById(detailContactId!),
    enabled: Boolean(detailContactId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const handleFilterApply = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters((prev) => ({
      ...prev,
      page: 1,
      search: searchTerm.trim() || undefined,
      customerId: selectedCustomer || undefined,
      unassigned: showUnassigned ? true : undefined,
    }));
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedCustomer(undefined);
    setShowUnassigned(false);
    setFilters({ page: 1, pageSize: 15, sortBy: 'createdAt', sortOrder: 'desc' });
  };

  const handleSortChange = (value: NonNullable<ContactFilters['sortBy']>) => {
    setFilters((prev) => ({ ...prev, sortBy: value, page: 1 }));
  };

  const handleSortDirection = () => {
    setFilters((prev) => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleOpenCreate = () => {
    setEditingContact(undefined);
    setFormOpen(true);
  };

  const handleEdit = (contact: ContactSummary) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleDelete = (contact: ContactSummary) => {
    if (window.confirm(`Delete contact ${contact.firstName} ${contact.lastName}?`)) {
      deleteMutation.mutate(contact.id);
    }
  };

  const handleSelectContact = (contact: ContactSummary) => {
    setDetailContactId(contact.id);
  };

  const pagination = useMemo(() => contactsQuery.data?.meta, [contactsQuery.data?.meta]);
  const customers = (customersQuery.data?.data ?? []) as CustomerSummary[];
  const canImport = user?.role === 'ADMIN';

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-600">
            Manage stakeholder relationships, link contacts to accounts, and stay on top of follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canImport && (
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <UploadCloud className="h-4 w-4" />
              Import Contacts
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Contact
          </button>
        </div>
      </div>

      <form onSubmit={handleFilterApply} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, email, phone or company"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Customer</label>
            <select
              value={selectedCustomer ?? ''}
              onChange={(event) => setSelectedCustomer(event.target.value || undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showUnassigned}
                onChange={(event) => setShowUnassigned(event.target.checked)}
              />
              Show only unassigned contacts
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Sort By</label>
              <select
                value={filters.sortBy ?? 'createdAt'}
                onChange={(event) => handleSortChange(event.target.value as NonNullable<ContactFilters['sortBy']>)}
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
                onClick={handleSortDirection}
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
            onClick={handleReset}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Reset
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {pagination
            ? `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                pagination.page * pagination.pageSize,
                pagination.total,
              )} of ${pagination.total}`
            : '0 contacts'}
        </span>
        {pagination && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page <span className="font-semibold text-gray-900">{pagination.page}</span> of{' '}
              <span className="font-semibold text-gray-900">{pagination.pageCount || 1}</span>
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= (pagination.pageCount || 1)}
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ContactsTable
        contacts={contactsQuery.data?.data}
        isLoading={contactsQuery.isLoading || contactsQuery.isFetching}
        onCreate={handleOpenCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelect={handleSelectContact}
      />

      {formOpen && (
        <ContactForm
          contact={editingContact}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false);
            setEditingContact(undefined);
          }}
        />
      )}

      {detailContactId && contactDetailQuery.data && (
        <ContactDetailPanel
          contact={contactDetailQuery.data}
          onClose={() => setDetailContactId(null)}
        />
      )}

      <ContactImportDialog
        open={importOpen}
        customers={customers}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}
