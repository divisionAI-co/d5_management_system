import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmployeesList } from '@/components/hr/employees/EmployeesList';
import { EmployeeForm } from '@/components/hr/employees/EmployeeForm';
import { EmployeeImportDialog } from '@/components/hr/employees/EmployeeImportDialog';
import { employeesApi } from '@/lib/api/hr';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { Employee } from '@/types/hr';

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Employee | null>(null);
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const canImport = user?.role === 'ADMIN' || user?.role === 'HR';

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowDeleteConfirm(null);
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
            console.log('Employee saved successfully');
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Delete Employee
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete{' '}
              <span className="font-semibold">
                {showDeleteConfirm.user?.firstName} {showDeleteConfirm.user?.lastName}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canImport && importOpen && (
        <EmployeeImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
