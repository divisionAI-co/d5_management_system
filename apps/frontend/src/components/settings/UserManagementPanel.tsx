import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, UserPlus, RefreshCcw, Trash2, X } from 'lucide-react';

import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';
import type {
  CreateUserPayload,
  UserListFilters,
  UserRole,
  UserSortField,
  UsersListResponse,
  UserSummary,
} from '@/types/users';

const DEFAULT_FORM: CreateUserPayload = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
  phone: '',
};

const ROLE_FILTERS: Array<{ label: string; value?: UserRole }> = [
  { label: 'All Roles', value: undefined },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Salesperson', value: 'SALESPERSON' },
  { label: 'Account Manager', value: 'ACCOUNT_MANAGER' },
  { label: 'Recruiter', value: 'RECRUITER' },
  { label: 'HR', value: 'HR' },
  { label: 'Employee', value: 'EMPLOYEE' },
];

const STATUS_FILTERS: Array<{ label: string; value?: boolean }> = [
  { label: 'All Statuses', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
];

const SORT_FIELDS: Array<{ label: string; value: UserSortField }> = [
  { label: 'Created', value: 'createdAt' },
  { label: 'Name', value: 'firstName' },
  { label: 'Email', value: 'email' },
  { label: 'Role', value: 'role' },
];

type SortState = { sortBy: UserSortField; sortOrder: 'asc' | 'desc' };

export function UserManagementPanel() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<UserListFilters>({
    page: 1,
    pageSize: 10,
  });
  const [sort, setSort] = useState<SortState>({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [formState, setFormState] = useState<CreateUserPayload>(DEFAULT_FORM);
  const [formPassword, setFormPassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sanitizedFilters = useMemo(() => {
    const payload: UserListFilters = {
      ...filters,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    };

    if (!payload.search) {
      delete payload.search;
    }
    if (payload.role === undefined) {
      delete payload.role;
    }
    if (payload.isActive === undefined) {
      delete payload.isActive;
    }

    return payload;
  }, [filters, sort]);

  const usersQuery = useQuery<UsersListResponse>({
    queryKey: ['users', sanitizedFilters],
    queryFn: () => usersApi.list(sanitizedFilters),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback('User invited successfully.');
      closeForm();
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message ?? 'Unable to invite user right now.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateUserPayload> & { password?: string } }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback('User updated successfully.');
      closeForm();
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message ?? 'Unable to update user at this time.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback('User deleted.');
    },
    onError: () => {
      setErrorMessage('Unable to delete user at this time.');
    },
  });

  if (user?.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 rounded-lg bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-semibold">Restricted Access</h1>
            <p className="text-sm text-amber-700">Only administrators can manage user accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  const openCreateForm = () => {
    setFormMode('create');
    setSelectedUser(null);
    setFormState(DEFAULT_FORM);
    setFormPassword('');
    setShowForm(true);
    setErrorMessage(null);
  };

  const openEditForm = (userRecord: UserSummary) => {
    setFormMode('edit');
    setSelectedUser(userRecord);
    setFormState({
      firstName: userRecord.firstName,
      lastName: userRecord.lastName,
      email: userRecord.email,
      password: '',
      role: userRecord.role,
      phone: userRecord.phone ?? '',
    });
    setFormPassword('');
    setErrorMessage(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (formMode === 'create') {
      if (!formPassword || formPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }

      createMutation.mutate({
        ...formState,
        password: formPassword,
        phone: formState.phone?.trim() || undefined,
      });
    } else if (formMode === 'edit' && selectedUser) {
      const payload: Partial<CreateUserPayload> & { password?: string } = {
        firstName: formState.firstName,
        lastName: formState.lastName,
        email: formState.email,
        role: formState.role,
        phone: formState.phone?.trim() || undefined,
      };

      if (formPassword) {
        if (formPassword.length < 8) {
          setErrorMessage('Password must be at least 8 characters long.');
          return;
        }
        payload.password = formPassword;
      }

      updateMutation.mutate({ id: selectedUser.id, payload });
    }
  };

  const handleDelete = (userRecord: UserSummary) => {
    if (
      window.confirm(
        `Delete ${userRecord.firstName} ${userRecord.lastName}? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(userRecord.id);
    }
  };

  const handleFilterChange = <K extends keyof UserListFilters>(key: K, value: UserListFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleSortChange = (field: UserSortField) => {
    setSort((prev) => ({
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-10 w-10 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-600">
              Invite teammates, assign roles and deactivate accounts from a single workspace.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => usersQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
          <button
            className="ml-2 text-xs font-semibold uppercase text-emerald-800 hover:underline"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Search</label>
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={(event) => handleFilterChange('search', event.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Role</label>
            <select
              value={filters.role ?? ''}
              onChange={(event) =>
                handleFilterChange(
                  'role',
                  (event.target.value || undefined) as UserRole | undefined,
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {ROLE_FILTERS.map((option) => (
                <option key={option.label} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              Status
            </label>
            <select
              value={filters.isActive === undefined ? '' : filters.isActive ? 'active' : 'inactive'}
              onChange={(event) => {
                const value = event.target.value;
                handleFilterChange('isActive', value === '' ? undefined : value === 'active');
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_FILTERS.map((option) => (
                <option
                  key={option.label}
                  value={option.value === undefined ? '' : option.value ? 'active' : 'inactive'}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Sort</label>
            <select
              value={sort.sortBy}
              onChange={(event) => handleSortChange(event.target.value as UserSortField)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {SORT_FIELDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-gray-700">
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    No users found. Adjust filters or invite a new user.
                  </td>
                </tr>
              ) : (
                users.map((userRecord) => (
                  <tr key={userRecord.id}>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {userRecord.firstName} {userRecord.lastName}
                    </td>
                    <td className="px-4 py-3">{userRecord.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase text-blue-600">
                        {userRecord.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          userRecord.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {userRecord.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(userRecord)}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(userRecord)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-4 text-sm text-gray-600 md:flex-row">
            <div>
              Showing {(meta.page - 1) * meta.pageSize + 1}-
              {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} users
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page === 1}
                onClick={() => handlePageChange((meta?.page ?? 1) - 1)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-semibold">
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => handlePageChange((meta?.page ?? 1) + 1)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 px-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {formMode === 'create' ? 'Invite New User' : 'Edit User'}
                </h2>
                <p className="text-sm text-gray-500">
                  {formMode === 'create'
                    ? 'Send an invitation by supplying initial credentials.'
                    : 'Update the user profile or reset their password.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.firstName}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.lastName}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formState.phone ?? ''}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Role
                  </label>
                  <select
                    value={formState.role}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, role: event.target.value as UserRole }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLE_FILTERS.slice(1).map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formMode === 'create' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(event) => setFormPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimum 8 characters"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Reset Password
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(event) => setFormPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                >
                  {formMode === 'create' ? 'Invite User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

