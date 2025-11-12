import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api/hr';
import { EmploymentStatus, Employee } from '@/types/hr';
import { format } from 'date-fns';
import {
  Users,
  UserPlus,
  UploadCloud,
  Search,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

interface EmployeesListProps {
  onEdit: (employee: Employee) => void;
  onView: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onCreateNew: () => void;
  onImport?: () => void;
  canImport?: boolean;
}

export function EmployeesList({ onEdit, onView, onDelete, onCreateNew, onImport, canImport }: EmployeesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const {
    data: employeesResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['employees', statusFilter, departmentFilter, searchTerm, page, pageSize],
    queryFn: () =>
      employeesApi.getAll({
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        search: searchTerm || undefined,
        page,
        pageSize,
      }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeesApi.getDepartments(),
  });

  const employees = employeesResponse?.data ?? [];
  const meta = employeesResponse?.meta;
  const total = meta?.total ?? 0;
  const currentPage = meta?.page ?? page;
  const currentPageSize = meta?.pageSize ?? pageSize;
  const pageCount = meta?.pageCount ?? Math.max(Math.ceil(total / currentPageSize), 1);
  const startIndex = total === 0 ? 0 : (currentPage - 1) * currentPageSize + 1;
  const endIndex = total === 0 ? 0 : Math.min(currentPage * currentPageSize, total);

  useEffect(() => {
    if (meta?.page && meta.page !== page) {
      setPage(meta.page);
    }
  }, [meta?.page, page]);

  const getStatusBadge = (status: EmploymentStatus) => {
    const styles = {
      ACTIVE: 'bg-green-100 text-green-800',
      ON_LEAVE: 'bg-yellow-100 text-yellow-800',
      TERMINATED: 'bg-red-100 text-red-800',
      RESIGNED: 'bg-muted/70 text-foreground',
    };
    return styles[status] || 'bg-muted/70 text-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employees</h1>
            <p className="text-sm text-muted-foreground">Manage your team members</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canImport && onImport && (
            <button
              onClick={onImport}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <UploadCloud className="w-4 h-4" />
              Import Employees
            </button>
          )}
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
            <option value="RESIGNED">Resigned</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Departments</option>
            {departments?.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading employees...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg shadow-sm border border-border">
          <Users className="mx-auto mb-4 h-16 w-16 text-border" />
          <h3 className="text-lg font-medium text-foreground mb-2">No employees found</h3>
          <p className="text-muted-foreground mb-6">Get started by adding your first employee</p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Employee
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Job Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hire Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Reviews/Leaves
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {employees.map((employee) => (
                <tr
                  key={employee.id}
                  className="cursor-pointer transition-colors hover:bg-muted focus-within:bg-muted"
                  role="button"
                  tabIndex={0}
                  onClick={() => onView(employee)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onView(employee);
                    }
                  }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {employee.user?.firstName?.[0]}{employee.user?.lastName?.[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-foreground">
                          {employee.user?.firstName} {employee.user?.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">{employee.employeeNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">{employee.jobTitle}</div>
                    <div className="text-sm text-muted-foreground">{employee.contractType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {employee.department || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(employee.status)}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(employee.hireDate), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <div className="flex gap-3">
                      <span>{employee._count?.performanceReviews || 0} reviews</span>
                      <span>•</span>
                      <span>{employee._count?.leaveRequests || 0} leaves</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onView(employee);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(employee);
                        }}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(employee);
                        }}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta && meta.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <span>
                Showing {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of {total.toLocaleString()} employees
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1 || isFetching}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {Math.max(pageCount, 1)}
                </span>
                <button
                  onClick={() => setPage((prev) => (pageCount ? Math.min(prev + 1, pageCount) : prev + 1))}
                  disabled={pageCount ? currentPage >= pageCount || isFetching : employees.length < currentPageSize}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

