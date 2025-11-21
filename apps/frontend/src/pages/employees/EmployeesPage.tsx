import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmployeesList } from '@/components/hr/employees/EmployeesList';
import { EmployeeForm } from '@/components/hr/employees/EmployeeForm';
import { EmployeeImportDialog } from '@/components/hr/employees/EmployeeImportDialog';
import { employeesApi } from '@/lib/api/hr';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Employee } from '@/types/hr';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Employee | null>(null);
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const canImport = user?.role === 'ADMIN' || user?.role === 'HR';

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSuccessMessage('Employee deleted successfully');
      setShowDeleteConfirm(null);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to delete employee');
    },
  });

  const handleCreateNew = () => {
    setSelectedEmployee(undefined);
    setShowForm(true);
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowForm(true);
  };

  const handleView = (employee: Employee) => {
    if (employee?.id) {
      navigate(`/employees/${employee.id}`);
    }
  };

  const handleDelete = (employee: Employee) => {
    setShowDeleteConfirm(employee);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteMutation.mutate(showDeleteConfirm.id);
    }
  };

  return (
    <div className="py-8">
      <EmployeesList
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        onImport={canImport ? () => setImportOpen(true) : undefined}
        canImport={canImport}
      />

      {showForm && (
        <EmployeeForm
          employee={selectedEmployee}
          onClose={() => {
            setShowForm(false);
            setSelectedEmployee(undefined);
          }}
          onSuccess={() => {
            if (import.meta.env.DEV) {
              console.log('Employee saved successfully');
            }
          }}
        />
      )}

      <ConfirmationDialog
        open={!!showDeleteConfirm}
        title="Delete Employee"
        message={
          <>
              Are you sure you want to delete{' '}
              <span className="font-semibold">
              {showDeleteConfirm?.user?.firstName} {showDeleteConfirm?.user?.lastName}
              </span>
              ? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(null)}
        isPending={deleteMutation.isPending}
      />

      {canImport && importOpen && (
        <EmployeeImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}
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
