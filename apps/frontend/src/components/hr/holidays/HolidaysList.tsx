import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { holidaysApi } from '@/lib/api/hr';
import type { NationalHoliday } from '@/types/hr';
import { format } from 'date-fns';
import { Calendar, Plus, Filter, Edit, Trash2 } from 'lucide-react';

interface HolidaysListProps {
  onCreateNew: () => void;
  onEdit: (holiday: NationalHoliday) => void;
  onDelete: (holiday: NationalHoliday) => void;
}

export function HolidaysList({ onCreateNew, onEdit, onDelete }: HolidaysListProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number | undefined>(currentYear);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.getAll(year),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">National Holidays</h1>
            <p className="text-sm text-muted-foreground">
              Manage the company holidays that impact scheduling and leave calculations.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              value={year ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setYear(value === '' ? undefined : Number(value));
              }}
              placeholder="Year"
              className="w-24 border-none text-sm focus:outline-none focus:ring-0"
            />
            <button
              onClick={() => setYear(undefined)}
              className="text-xs text-blue-600 transition hover:text-blue-700"
            >
              All Years
            </button>
          </div>

          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New Holiday
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : holidays && holidays.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Holiday
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recurring
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Country
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {holidays.map((holiday) => (
                <tr key={holiday.id} className="transition hover:bg-muted">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{holiday.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {format(new Date(holiday.date), 'MMMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {holiday.isRecurring ? (
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{holiday.country}</td>
                  <td className="px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(holiday)}
                        className="rounded-lg p-2 text-green-600 transition hover:bg-green-50 hover:text-green-700"
                        title="Edit holiday"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(holiday)}
                        className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                        title="Delete holiday"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-border" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No holidays registered</h3>
          <p className="mt-2 text-muted-foreground">Start by adding the public holidays for your region.</p>
          <button
            onClick={onCreateNew}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New Holiday
          </button>
        </div>
      )}
    </div>
  );
}


