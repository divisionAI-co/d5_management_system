import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import type { CreateEmployeeDto, UpdateEmployeeDto, Employee, ContractType, EmploymentStatus } from '@/types/hr';
import { X } from 'lucide-react';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface EmployeeFormProps {
  employee?: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmployeeForm({ employee, onClose, onSuccess }: EmployeeFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!employee;
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: usersResponse, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users', 'employee-select'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
  });

  const availableUsers = useMemo(() => {
    const users = usersResponse?.data ?? [];
    if (!users) {
      return [];
    }

    return users.filter((user) => !user.employee || (employee && user.id === employee.userId));
  }, [usersResponse, employee]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEmployeeDto | UpdateEmployeeDto>({
    defaultValues: employee ? {
      userId: employee.userId,
      employeeNumber: employee.employeeNumber,
      jobTitle: employee.jobTitle,
      department: employee.department || '',
      contractType: employee.contractType,
      status: employee.status,
      hireDate: employee.hireDate?.split('T')[0],
      terminationDate: employee.terminationDate?.split('T')[0] || '',
      salary: employee.salary,
      salaryCurrency: employee.salaryCurrency || 'USD',
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
      emergencyContactRelation: employee.emergencyContactRelation || '',
      cardNumber: employee.cardNumber || '',
      bookingLink: employee.bookingLink || '',
    } : {
      userId: '',
      salaryCurrency: 'USD',
      contractType: 'FULL_TIME' as ContractType,
      status: 'ACTIVE' as EmploymentStatus,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeDto) => employeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSuccessMessage('Employee created successfully');
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to create employee');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateEmployeeDto) => employeesApi.update(employee!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employee!.id] });
      setSuccessMessage('Employee updated successfully');
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to update employee');
    },
  });

  const onSubmit = (data: any) => {
    const payload = { ...data };

    if ('terminationDate' in payload && !payload.terminationDate) {
      delete payload.terminationDate;
    }

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {isEdit ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground p-2 rounded-lg hover:bg-muted/70"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Assign User *
                </label>
                {isUsersLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Loading users...
                  </div>
                ) : availableUsers.length > 0 || isEdit ? (
                  <select
                    {...register('userId', { required: 'User is required' })}
                    disabled={isEdit}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-muted/70 disabled:text-muted-foreground"
                  >
                    <option value="">Select a user</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} — {user.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    All existing users already have employee profiles. Please create a new user
                    first, then return to assign the employee record.
                  </div>
                )}
                {errors.userId && (
                  <p className="mt-1 text-sm text-red-600">{errors.userId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Employee Number *
                </label>
                <input
                  type="text"
                  {...register('employeeNumber', { required: 'Employee number is required' })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="EMP001"
                />
                {errors.employeeNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.employeeNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  {...register('cardNumber')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Booking Link
                </label>
                <input
                  type="url"
                  {...register('bookingLink')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://calendly.com/john-doe"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Link to your booking calendar (e.g., Calendly, Google Calendar)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  {...register('jobTitle', { required: 'Job title is required' })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Senior Developer"
                />
                {errors.jobTitle && (
                  <p className="mt-1 text-sm text-red-600">{errors.jobTitle.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Department
                </label>
                <input
                  type="text"
                  {...register('department')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Engineering"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Contract Type *
                </label>
                <select
                  {...register('contractType', { required: 'Contract type is required' })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Employment Status *
                </label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="TERMINATED">Terminated</option>
                  <option value="RESIGNED">Resigned</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Hire Date *
                </label>
                <input
                  type="date"
                  {...register('hireDate', { required: 'Hire date is required' })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.hireDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.hireDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Termination Date
                </label>
                <input
                  type="date"
                  {...register('terminationDate')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Compensation</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Salary *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('salary', {
                    required: 'Salary is required',
                    valueAsNumber: true,
                  })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="75000"
                />
                {errors.salary && (
                  <p className="mt-1 text-sm text-red-600">{errors.salary.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Currency
                </label>
                <select
                  {...register('salaryCurrency')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ALL">ALL</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Emergency Contact</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  {...register('emergencyContactName')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  {...register('emergencyContactPhone')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  {...register('emergencyContactRelation')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Spouse"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? 'Saving...'
                : isEdit
                ? 'Update Employee'
                : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
      {successMessage && (
        <FeedbackToast
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          tone="success"
        />
      )}
      {errorMessage && (
        <FeedbackToast
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          tone="error"
        />
      )}
    </div>
  );
}

