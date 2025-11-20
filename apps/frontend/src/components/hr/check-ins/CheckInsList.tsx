import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkInsApi } from '@/lib/api/hr';
import { employeesApi } from '@/lib/api/hr';
import type { EmployeeCheckIn, CheckInFilters } from '@/types/hr';
import { format } from 'date-fns';
import { Clock, Plus, Filter, Edit, Trash2, Upload, UserX } from 'lucide-react';

interface CheckInsListProps {
  onCreateNew: () => void;
  onEdit: (checkIn: EmployeeCheckIn) => void;
  onDelete: (checkIn: EmployeeCheckIn) => void;
  onImport: () => void;
  canManage?: boolean;
}

export function CheckInsList({ onCreateNew, onEdit, onDelete, onImport, canManage = false }: CheckInsListProps) {
  const [filters, setFilters] = useState<CheckInFilters>({
    page: 1,
    pageSize: 50,
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['check-ins', filters],
    queryFn: () => checkInsApi.getAll(filters),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'select'],
    queryFn: () => employeesApi.getAll({ pageSize: 1000 }),
    enabled: canManage, // Only fetch employees if user can manage (for filtering)
  });

  const checkIns = data?.data || [];
  const pagination = data?.pagination;
  const employees = employeesData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Check-ins & Check-outs</h1>
            <p className="text-sm text-muted-foreground">
              Manage employee check-in and check-out records.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-foreground transition hover:bg-muted"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {canManage && (
            <>
              <button
                onClick={onImport}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-foreground transition hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                New Check-in
              </button>
            </>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Search</label>
              <input
                type="text"
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                placeholder="Name, email, or card number..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {canManage && (
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Employee</label>
                <select
                  value={filters.employeeId || ''}
                  onChange={(e) => setFilters({ ...filters, employeeId: e.target.value || undefined, page: 1 })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Employees</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.user.firstName} {employee.user.lastName}
                      {employee.user.email && ` (${employee.user.email})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Start Date</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">End Date</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
            <button
              onClick={() => setFilters({ page: 1, pageSize: 50 })}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:bg-muted"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : checkIns.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Card Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  {canManage && (
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {checkIns.map((checkIn) => (
                  <tr key={checkIn.id} className="transition hover:bg-muted">
                    <td className="px-6 py-4 text-sm text-foreground">
                      {format(new Date(checkIn.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(checkIn.time), 'HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {checkIn.firstName} {checkIn.lastName}
                        </span>
                        {checkIn.employee ? (
                          <span className="text-xs text-muted-foreground">
                            {checkIn.employee.user.firstName} {checkIn.employee.user.lastName}
                            {checkIn.employee.user.email && ` (${checkIn.employee.user.email})`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <UserX className="h-3 w-3" />
                            Not linked to employee
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {checkIn.employeeCardNumber}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {checkIn.status === 'IN' ? (
                        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          IN
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          OUT
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onEdit(checkIn)}
                            className="rounded-lg p-2 text-green-600 transition hover:bg-green-50 hover:text-green-700"
                            title="Edit check-in"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDelete(checkIn)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                            title="Delete check-in"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                  disabled={pagination.page <= 1}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-border" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No check-ins found</h3>
          <p className="mt-2 text-muted-foreground">
            {canManage
              ? 'Start by adding a check-in record or importing from a file.'
              : 'No check-in records found for your account.'}
          </p>
          {canManage && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={onImport}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-foreground transition hover:bg-muted"
              >
                <Upload className="h-5 w-5" />
                Import
              </button>
              <button
                onClick={onCreateNew}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                New Check-in
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

