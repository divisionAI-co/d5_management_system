import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { holidaysApi } from '@/lib/api/hr';
import type { NationalHoliday, CreateHolidayDto, UpdateHolidayDto } from '@/types/hr';
import { X } from 'lucide-react';

interface HolidayFormProps {
  holiday?: NationalHoliday;
  onClose: () => void;
  onSuccess: () => void;
}

type FormValues = {
  name: string;
  date: string;
  isRecurring: boolean;
};

export function HolidayForm({ holiday, onClose, onSuccess }: HolidayFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!holiday;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: holiday
      ? {
          name: holiday.name,
          date: holiday.date.split('T')[0],
          isRecurring: holiday.isRecurring,
        }
      : {
          name: '',
          date: '',
          isRecurring: true,
        },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateHolidayDto) => holidaysApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      onSuccess();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateHolidayDto) => holidaysApi.update(holiday!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holiday', holiday!.id] });
      onSuccess();
      onClose();
    },
  });

  const onSubmit = (data: FormValues) => {
    const payload = {
      name: data.name,
      date: data.date,
      isRecurring: data.isRecurring,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Edit Holiday' : 'Add Holiday'}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit ? 'Update holiday details.' : 'Add a new official holiday.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Holiday Name *</label>
            <input
              type="text"
              {...register('name', { required: 'Holiday name is required' })}
              placeholder="Independence Day"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
          </div>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              {...register('isRecurring')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">This holiday recurs every year</span>
          </label>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit
                ? 'Update Holiday'
                : 'Create Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


