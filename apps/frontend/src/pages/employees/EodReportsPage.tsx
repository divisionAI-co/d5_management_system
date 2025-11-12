import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { EodReportsList } from '@/components/hr/eod/EodReportsList';
import { EodReportForm } from '@/components/hr/eod/EodReportForm';
import { EodImportDialog } from '@/components/hr/eod/EodImportDialog';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@prisma/client';
import type { EodReport } from '@/types/hr';

export default function EodReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { employeeId?: string; employeeName?: string; userId?: string } | null;
  const employeeIdFilter = state?.employeeId;
  const employeeName = state?.employeeName;
  const userIdFilter = state?.userId;

  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<EodReport | null>(null);
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const canImport = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;

  const handleCreate = () => {
    setSelectedReport(null);
    setShowForm(true);
  };

  const handleEdit = (report: EodReport) => {
    setSelectedReport(report);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedReport(null);
  };

  return (
    <div className="py-8 space-y-6">
      {employeeIdFilter && (
        <button
          onClick={() => navigate(`/employees/${employeeIdFilter}`)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Back to {employeeName || 'Employee'}
        </button>
      )}

      <EodReportsList
        onCreateNew={handleCreate}
        onEdit={handleEdit}
        filterUserId={userIdFilter}
        contextLabel={employeeName}
        onImport={canImport ? () => setImportOpen(true) : undefined}
        canImport={canImport}
      />

      {showForm && (
        <EodReportForm
          report={selectedReport ?? undefined}
          employeeId={employeeIdFilter}
          onClose={handleCloseForm}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
            if (userIdFilter) {
              queryClient.invalidateQueries({ queryKey: ['eod-reports', userIdFilter] });
            }
            setSelectedReport(null);
            setShowForm(false);
          }}
        />
      )}

      {canImport && importOpen && (
        <EodImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

