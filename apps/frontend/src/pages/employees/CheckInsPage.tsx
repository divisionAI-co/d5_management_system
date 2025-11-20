import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckInsList } from '@/components/hr/check-ins/CheckInsList';
import { CheckInForm } from '@/components/hr/check-ins/CheckInForm';
import { CheckInImportDialog } from '@/components/hr/check-ins/CheckInImportDialog';
import { checkInsApi } from '@/lib/api/hr';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { EmployeeCheckIn } from '@/types/hr';
import { UserRole } from '@/types/enums';

export default function CheckInsPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<EmployeeCheckIn | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<EmployeeCheckIn | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => checkInsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      setShowDeleteConfirm(null);
    },
  });

  const handleCreateNew = () => {
    if (!canManage) {
      return;
    }
    setSelectedCheckIn(undefined);
    setShowForm(true);
  };

  const handleEdit = (checkIn: EmployeeCheckIn) => {
    if (!canManage) {
      return;
    }
    setSelectedCheckIn(checkIn);
    setShowForm(true);
  };

  const handleDelete = (checkIn: EmployeeCheckIn) => {
    if (!canManage) {
      return;
    }
    setShowDeleteConfirm(checkIn);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteMutation.mutate(showDeleteConfirm.id);
    }
  };

  const handleImport = () => {
    if (!canManage) {
      return;
    }
    setImportOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <CheckInsList
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onImport={handleImport}
        canManage={canManage}
      />

      {showForm && (
        <CheckInForm
          checkIn={selectedCheckIn}
          onClose={() => {
            setShowForm(false);
            setSelectedCheckIn(undefined);
          }}
          onSuccess={() => {
            setShowForm(false);
            setSelectedCheckIn(undefined);
          }}
        />
      )}

      {importOpen && (
        <CheckInImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Delete Check-in</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this check-in record? This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
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

