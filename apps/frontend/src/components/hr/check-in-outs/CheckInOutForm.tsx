import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInOutsApi, employeesApi } from '@/lib/api/hr';
import type { CreateCheckInOutDto, UpdateCheckInOutDto, CheckInOut } from '@/types/hr/check-in-out';
import { CheckInOutStatus } from '@/types/hr/check-in-out';
import { X } from 'lucide-react';

interface CheckInOutFormProps {
  record?: CheckInOut;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckInOutForm({ record, onClose, onSuccess }: CheckInOutFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!record;

  const { data: employeesResponse } = useQuery({
    queryKey: ['employees', 'select'],
    queryFn: () => employeesApi.getAll({ page: 1, pageSize: 100 }),
  });

  const employees = employeesResponse?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCheckInOutDto | UpdateCheckInOutDto>({
    defaultValues: record ? {
      employeeId: record.employeeId,
      dateTime: new Date(record.dateTime).toISOString().slice(0, 16),
      status: record.status,
    } : {
      dateTime: new Date().toISOString().slice(0, 16),
      status: CheckInOutStatus.IN,
    },
  });

  // Fix race condition: reset form values once employees are loaded and when record changes
  useEffect(() => {
    if (record) {
      // When editing, wait for employees to load before setting the value
      if (employees.length > 0) {
        const employeeExists = employees.some(emp => emp.id === record.employeeId);
        if (employeeExists) {
          reset({
            employeeId: record.employeeId,
            dateTime: new Date(record.dateTime).toISOString().slice(0, 16),
            status: record.status,
          });
        }
      }
    }
  }, [record, employees, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateCheckInOutDto) => checkInOutsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-in-outs'] });
      onSuccess();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCheckInOutDto) => checkInOutsApi.update(record!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-in-outs'] });
      onSuccess();
      onClose();
    },
  });

  const onSubmit = (data: any) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data as CreateCheckInOutDto);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {isEdit ? 'Edit Check-In/Out Record' : 'Add Check-In/Out Record'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/70"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Employee *
            </label>
            <select
              {...register('employeeId', { required: 'Employee is required' })}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-muted/70"
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.user ? `${emp.user.firstName} ${emp.user.lastName}` : emp.employeeNumber}
                </option>
              ))}
            </select>
            {errors.employeeId && (
              <p className="mt-1 text-sm text-red-600">{errors.employeeId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              {...register('dateTime', { required: 'Date and time is required' })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.dateTime && (
              <p className="mt-1 text-sm text-red-600">{errors.dateTime.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Status *
            </label>
            <select
              {...register('status', { required: 'Status is required' })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={CheckInOutStatus.IN}>IN</option>
              <option value={CheckInOutStatus.OUT}>OUT</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
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
                ? 'Update Record'
                : 'Add Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

