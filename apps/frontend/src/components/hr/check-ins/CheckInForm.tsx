import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { checkInsApi } from '@/lib/api/hr';
import { employeesApi } from '@/lib/api/hr';
import type { EmployeeCheckIn, CreateCheckInDto, UpdateCheckInDto } from '@/types/hr';
import { X } from 'lucide-react';

interface CheckInFormProps {
  checkIn?: EmployeeCheckIn;
  onClose: () => void;
  onSuccess: () => void;
}

type FormValues = {
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  employeeCardNumber: string;
  status: 'IN' | 'OUT';
  employeeId: string;
};

export function CheckInForm({ checkIn, onClose, onSuccess }: CheckInFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!checkIn;

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'select'],
    queryFn: () => employeesApi.getAll({ pageSize: 1000 }),
  });

  const employees = employeesData?.data || [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: checkIn
      ? {
          date: checkIn.date.split('T')[0],
          time: new Date(checkIn.time).toISOString().slice(0, 16),
          firstName: checkIn.firstName,
          lastName: checkIn.lastName,
          employeeCardNumber: checkIn.employeeCardNumber,
          status: checkIn.status,
          employeeId: checkIn.employeeId || '',
        }
      : {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toISOString().slice(0, 16),
          firstName: '',
          lastName: '',
          employeeCardNumber: '',
          status: 'IN',
          employeeId: '',
        },
  });

  const selectedEmployeeId = watch('employeeId');
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // Auto-fill name and card number when employee is selected
  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setValue('employeeId', employeeId);
      setValue('firstName', employee.user.firstName);
      setValue('lastName', employee.user.lastName);
      if (employee.cardNumber) {
        setValue('employeeCardNumber', employee.cardNumber);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateCheckInDto) => checkInsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      onSuccess();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateCheckInDto) => checkInsApi.update(checkIn!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      queryClient.invalidateQueries({ queryKey: ['check-in', checkIn!.id] });
      onSuccess();
      onClose();
    },
  });

  const onSubmit = (data: FormValues) => {
    if (!data.employeeId) {
      return; // Should not happen due to validation, but safety check
    }

    const payload = {
      date: data.date,
      time: new Date(data.time).toISOString(),
      firstName: data.firstName,
      lastName: data.lastName,
      employeeCardNumber: data.employeeCardNumber,
      status: data.status,
      employeeId: data.employeeId,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isEdit ? 'Edit Check-in' : 'Add Check-in'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update check-in details.' : 'Add a new check-in or check-out record.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Date *</label>
              <input
                type="date"
                {...register('date', { required: 'Date is required' })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Time *</label>
              <input
                type="datetime-local"
                {...register('time', { required: 'Time is required' })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.time && (
                <p className="mt-1 text-xs text-red-600">{errors.time.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                First Name *
              </label>
              <input
                type="text"
                {...register('firstName', { required: 'First name is required' })}
                placeholder="John"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Last Name *
              </label>
              <input
                type="text"
                {...register('lastName', { required: 'Last name is required' })}
                placeholder="Doe"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Employee *
            </label>
            <select
              {...register('employeeId', { required: 'Employee is required' })}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select an employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.user.firstName} {employee.user.lastName}
                  {employee.user.email && ` (${employee.user.email})`}
                  {employee.cardNumber && ` - Card: ${employee.cardNumber}`}
                </option>
              ))}
            </select>
            {errors.employeeId && (
              <p className="mt-1 text-xs text-red-600">{errors.employeeId.message}</p>
            )}
            {selectedEmployee && (
              <p className="mt-1 text-xs text-muted-foreground">
                Selected: {selectedEmployee.user.firstName} {selectedEmployee.user.lastName}
                {selectedEmployee.cardNumber && ` (Card: ${selectedEmployee.cardNumber})`}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Employee Card Number *
            </label>
            <input
              type="text"
              {...register('employeeCardNumber', { required: 'Card number is required' })}
              placeholder="12345"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.employeeCardNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.employeeCardNumber.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Status *</label>
            <select
              {...register('status', { required: 'Status is required' })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-xs text-red-600">{errors.status.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit
                  ? 'Update'
                  : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

