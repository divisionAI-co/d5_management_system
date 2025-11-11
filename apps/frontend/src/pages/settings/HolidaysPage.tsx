import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { holidaysApi } from '@/lib/api/hr';
import { HolidaysList } from '@/components/hr/holidays/HolidaysList';
import { HolidayForm } from '@/components/hr/holidays/HolidayForm';
import type { NationalHoliday } from '@/types/hr';

export default function HolidaysPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<NationalHoliday | undefined>();
  const [deleteHoliday, setDeleteHoliday] = useState<NationalHoliday | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => holidaysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setDeleteHoliday(null);
    },
  });

  const handleCreate = () => {
    setSelectedHoliday(undefined);
    setShowForm(true);
  };

  const handleEdit = (holiday: NationalHoliday) => {
    setSelectedHoliday(holiday);
    setShowForm(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Holidays</h1>
        <p className="text-sm text-gray-500">
          Configure the global calendar of national and company-wide holidays.
        </p>
      </div>

      <HolidaysList onCreateNew={handleCreate} onEdit={handleEdit} onDelete={setDeleteHoliday} />

      {showForm && (
        <HolidayForm
          holiday={selectedHoliday}
          onClose={() => {
            setShowForm(false);
            setSelectedHoliday(undefined);
          }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['holidays'] })}
        />
      )}

      {deleteHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Holiday</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteHoliday.name}</span>? This action cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteHoliday(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteHoliday.id)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


