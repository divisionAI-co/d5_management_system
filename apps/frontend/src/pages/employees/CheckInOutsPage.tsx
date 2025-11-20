import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckInOutsList } from '@/components/hr/check-in-outs/CheckInOutsList';
import { CheckInOutForm } from '@/components/hr/check-in-outs/CheckInOutForm';
import { CheckInOutImportDialog } from '@/components/hr/check-in-outs/CheckInOutImportDialog';
import { checkInOutsApi } from '@/lib/api/hr';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/types/enums';
import type { CheckInOut } from '@/types/hr/check-in-out';

export default function CheckInOutsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { employeeId?: string; employeeName?: string } | null;
  const employeeIdFilter = state?.employeeId;
  const employeeName = state?.employeeName;

  const [showForm, setShowForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CheckInOut | null>(null);
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const canImport = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;

  const handleCreate = () => {
    setSelectedRecord(null);
    setShowForm(true);
  };

  const handleEdit = (record: CheckInOut) => {
    setSelectedRecord(record);
    setShowForm(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => checkInOutsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-in-outs'] });
    },
  });

  const handleDelete = (record: CheckInOut) => {
    if (window.confirm('Are you sure you want to delete this check-in/out record?')) {
      deleteMutation.mutate(record.id);
    }
  };

  return (
    <div className="container mx-auto p-6">
      {employeeIdFilter && (
        <button
          onClick={() => navigate(`/employees/${employeeIdFilter}`)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          ← Back to {employeeName || 'Employee'}
        </button>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Check-In/Check-Out Records</h1>
        <p className="text-muted-foreground mt-2">
          {employeeName ? `Check-in/out records for ${employeeName}` : 'Track employee check-in and check-out times'}
        </p>
      </div>

      <CheckInOutsList
        onCreateNew={canImport ? handleCreate : undefined}
        onEdit={canImport ? handleEdit : undefined}
        onDelete={canImport ? handleDelete : undefined}
        onImport={canImport ? () => setImportOpen(true) : undefined}
        canImport={canImport}
        employeeId={employeeIdFilter}
      />

      {showForm && (
        <CheckInOutForm
          record={selectedRecord || undefined}
          onClose={() => {
            setShowForm(false);
            setSelectedRecord(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setSelectedRecord(null);
          }}
        />
      )}

      {importOpen && (
        <CheckInOutImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}

