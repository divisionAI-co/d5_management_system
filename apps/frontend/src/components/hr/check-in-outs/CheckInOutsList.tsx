import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkInOutsApi, employeesApi } from '@/lib/api/hr';
import type { CheckInOut } from '@/types/hr/check-in-out';
import { CheckInOutStatus } from '@/types/hr/check-in-out';
import { format } from 'date-fns';
import { Edit3, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/types/enums';

interface CheckInOutsListProps {
  onCreateNew?: () => void;
  onEdit?: (record: CheckInOut) => void;
  onDelete?: (record: CheckInOut) => void;
  onImport?: () => void;
  employeeId?: string;
  canImport?: boolean;
}

export function CheckInOutsList({
  onCreateNew,
  onEdit,
  onDelete,
  onImport,
  employeeId,
  canImport,
}: CheckInOutsListProps) {
  const { user } = useAuthStore();
  const isPrivileged = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;
  
  const [startDate, setStartDate] = useState<string>(
    format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<CheckInOutStatus | ''>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employeeId || '');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch employees for the filter dropdown (only for admin/HR)
  const { data: employeesResponse } = useQuery({
    queryKey: ['employees', 'for-filter'],
    queryFn: () => employeesApi.getAll({ page: 1, pageSize: 100 }),
    enabled: isPrivileged,
  });

  const employees = employeesResponse?.data ?? [];

  // Sync selectedEmployeeId with employeeId prop when it changes (from navigation)
  useEffect(() => {
    if (employeeId) {
      setSelectedEmployeeId(employeeId);
    }
  }, [employeeId]);

  // Use employeeId prop if provided (from navigation), otherwise use the selectedEmployeeId filter
  const effectiveEmployeeId = employeeId || selectedEmployeeId || undefined;

  const { data: response, isLoading } = useQuery({
    queryKey: ['check-in-outs', effectiveEmployeeId, startDate, endDate, statusFilter, page, pageSize, isPrivileged],
    queryFn: async () => {
      const filters = {
        page,
        pageSize,
        startDate,
        endDate,
        status: statusFilter || undefined,
        employeeId: effectiveEmployeeId,
      };

      return isPrivileged
        ? await checkInOutsApi.getAll(filters)
        : await checkInOutsApi.getMine(filters);
    },
  });

  const records = response?.data ?? [];
  const meta = response?.meta;

  const getStatusBadge = (status: CheckInOutStatus) => {
    return status === CheckInOutStatus.IN ? (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
        IN
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
        OUT
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className={`grid grid-cols-1 gap-4 ${isPrivileged ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          {isPrivileged && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Employee
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setPage(1); // Reset to first page when filter changes
                }}
                disabled={!!employeeId} // Disable if employeeId is provided via prop
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-muted/70 disabled:cursor-not-allowed"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : emp.employeeNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1); // Reset to first page when filter changes
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1); // Reset to first page when filter changes
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as CheckInOutStatus | '');
                setPage(1); // Reset to first page when filter changes
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value={CheckInOutStatus.IN}>IN</option>
              <option value={CheckInOutStatus.OUT}>OUT</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            {canImport && onImport && (
              <button
                onClick={onImport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                Import
              </button>
            )}
            {isPrivileged && onCreateNew && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Record
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No check-in/out records found</div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Date & Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Employee</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Status</th>
                  {isPrivileged && (
                    <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {format(new Date(record.dateTime), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {record.employee?.user
                        ? `${record.employee.user.firstName} ${record.employee.user.lastName}`
                        : record.employee?.employeeNumber || 'Unknown'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                    {isPrivileged && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(record)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(record)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.pageCount > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Showing {((meta.page - 1) * meta.pageSize) + 1} to {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} records
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={meta.page === 1}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(meta.pageCount, p + 1))}
                  disabled={meta.page === meta.pageCount}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

