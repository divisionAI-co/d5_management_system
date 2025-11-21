import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ShieldCheck, UserPlus } from 'lucide-react';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import type { Candidate } from '@/types/recruitment';
import type {
  ConvertCandidateToEmployeePayload,
  ConvertCandidateToEmployeeResponse,
} from '@/types/recruitment';
import type { ContractType, EmploymentStatus, Employee } from '@/types/hr';
import type { UserRole, UserSummary } from '@/types/users';
import { ContractType as ContractTypeEnum, EmploymentStatus as EmploymentStatusEnum } from '@/types/hr';
import { usersApi } from '@/lib/api/users';
import { employeesApi } from '@/lib/api/hr/employees';
import { candidatesApi } from '@/lib/api/recruitment';

interface CandidateConvertToEmployeeModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSuccess: (response: ConvertCandidateToEmployeeResponse) => void;
}

type FormValues = {
  mode: 'existing' | 'new';
  userId?: string;
  autoGeneratePassword: boolean;
  role: UserRole;
  password?: string;
  confirmPassword?: string;
  phone?: string;
  employeeNumber: string;
  department?: string;
  jobTitle: string;
  status: EmploymentStatus;
  contractType: ContractType;
  hireDate: string;
  terminationDate?: string;
  salary: number;
  salaryCurrency: string;
  managerId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
};

const today = new Date().toISOString().split('T')[0];

export function CandidateConvertToEmployeeModal({
  candidate,
  onClose,
  onSuccess,
}: CandidateConvertToEmployeeModalProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      mode: 'new',
      autoGeneratePassword: true,
      role: 'EMPLOYEE',
      employeeNumber: '',
      department: candidate.currentTitle ? undefined : '',
      jobTitle: candidate.currentTitle || '',
      status: EmploymentStatusEnum.ACTIVE,
      contractType: ContractTypeEnum.FULL_TIME,
      hireDate: today,
      terminationDate: undefined,
      salary: candidate.expectedSalary ?? 0,
      salaryCurrency: candidate.salaryCurrency || 'USD',
      phone: candidate.phone ?? '',
    },
  });

  const mode = watch('mode');
  const autoGeneratePassword = watch('autoGeneratePassword');
  const passwordValue = watch('password');

  const usersQuery = useQuery({
    queryKey: ['users', 'employee-select'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
  });

  const employeesQuery = useQuery({
    queryKey: ['employees', 'manager-select'],
    queryFn: () => employeesApi.getAll(),
  });

  const availableUsers = useMemo(() => {
    const users = usersQuery.data?.data ?? [];
    return users.filter((user) => !user.employee);
  }, [usersQuery.data]);

  useEffect(() => {
    if (availableUsers.length === 0) {
      return;
    }

    const autoMatch = availableUsers.find(
      (user) => user.email.toLowerCase() === candidate.email.toLowerCase(),
    );

    if (autoMatch) {
      setValue('mode', 'existing');
      setValue('userId', autoMatch.id);
    }
  }, [availableUsers, candidate.email, setValue]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const convertMutation = useMutation({
    mutationFn: (payload: ConvertCandidateToEmployeePayload) =>
      candidatesApi.convertToEmployee(candidate.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSuccessMessage('Candidate converted to employee successfully');
      onSuccess(data);
      setTimeout(() => {
      onClose();
      }, 1000);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Failed to convert candidate to employee.';
      setServerError(Array.isArray(message) ? message.join(' ') : message);
    },
  });

  const handleFormSubmit = (values: FormValues) => {
    setServerError(null);

    if (values.mode === 'existing' && !values.userId) {
      setServerError('Please select an existing user to link.');
      return;
    }

    if (
      values.mode === 'new' &&
      !values.autoGeneratePassword &&
      (!values.password || values.password.length < 8)
    ) {
      setServerError('Password must be at least 8 characters when auto generation is disabled.');
      return;
    }

    if (values.mode === 'new' && !values.autoGeneratePassword && values.password !== values.confirmPassword) {
      setServerError('Password confirmation does not match.');
      return;
    }

    const payload: ConvertCandidateToEmployeePayload = {
      employeeNumber: values.employeeNumber,
      department: values.department || undefined,
      jobTitle: values.jobTitle || undefined,
      status: values.status,
      contractType: values.contractType,
      hireDate: values.hireDate,
      terminationDate: values.terminationDate || undefined,
      salary: values.salary,
      salaryCurrency: values.salaryCurrency || undefined,
      managerId: values.managerId || undefined,
      emergencyContactName: values.emergencyContactName || undefined,
      emergencyContactPhone: values.emergencyContactPhone || undefined,
      emergencyContactRelation: values.emergencyContactRelation || undefined,
    };

    if (values.mode === 'existing') {
      payload.userId = values.userId;
    } else {
      payload.autoGeneratePassword = values.autoGeneratePassword;
      payload.user = {
        phone: values.phone || undefined,
        role: values.role,
        password: values.autoGeneratePassword ? undefined : values.password,
      };
    }

    convertMutation.mutate(payload);
  };

  const managerOptions = useMemo(() => {
    const employees = employeesQuery.data?.data ?? [];
    return employees.filter((employee) => employee.id !== candidate.employee?.id);
  }, [employeesQuery.data, candidate.employee?.id]);

  const isSubmitting = convertMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Convert Candidate to Employee</h2>
            <p className="text-sm text-muted-foreground">
              Create an employee profile using {candidate.firstName} {candidate.lastName}&apos;s
              recruitment data.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 px-6 py-6">
          {serverError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {serverError}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <UserPlus className="h-5 w-5 text-blue-500" />
              User Assignment
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex cursor-pointer flex-col gap-2 rounded-xl border px-4 py-3 transition hover:border-blue-400">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Create a new user</span>
                  <input
                    type="radio"
                    value="new"
                    {...register('mode')}
                    checked={mode === 'new'}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Use the candidate&apos;s email and details to create a new user account.
                </p>
              </label>

              <label className="flex cursor-pointer flex-col gap-2 rounded-xl border px-4 py-3 transition hover:border-blue-400">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Link existing user</span>
                  <input
                    type="radio"
                    value="existing"
                    {...register('mode')}
                    checked={mode === 'existing'}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a user account without an employee profile to link with this candidate.
                </p>
              </label>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Select user</label>
                <select
                  {...register('userId')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Choose a user account</option>
                  {availableUsers.map((user: UserSummary) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} — {user.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Only users without an employee record are shown.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">User role</label>
                  <select
                    {...register('role')}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ACCOUNT_MANAGER">Account Manager</option>
                    <option value="HR">HR</option>
                    <option value="RECRUITER">Recruiter</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <input
                    type="tel"
                    {...register('phone')}
                    placeholder="+1234567890"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      {...register('autoGeneratePassword')}
                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    Automatically generate a secure password
                  </label>
                  <p className="text-xs text-muted-foreground">
                    If enabled, a password will be generated and shown after conversion.
                  </p>
                </div>

                {!autoGeneratePassword && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Password</label>
                      <input
                        type="password"
                        {...register('password', { minLength: 8 })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      {errors.password && (
                        <p className="text-xs text-rose-600">Password must be at least 8 characters.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Confirm Password</label>
                      <input
                        type="password"
                        {...register('confirmPassword', {
                          validate: (value) =>
                            autoGeneratePassword || value === passwordValue || 'Passwords do not match.',
                        })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      {errors.confirmPassword && (
                        <p className="text-xs text-rose-600">{errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Employment Details
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Employee Number<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('employeeNumber', { required: 'Employee number is required' })}
                  placeholder="EMP-001"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {errors.employeeNumber && (
                  <p className="text-xs text-rose-600">{errors.employeeNumber.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Job Title<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('jobTitle', { required: 'Job title is required' })}
                  placeholder="Senior Developer"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {errors.jobTitle && <p className="text-xs text-rose-600">{errors.jobTitle.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <input
                  type="text"
                  {...register('department')}
                  placeholder="Engineering"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Contract Type<span className="text-rose-500">*</span>
                </label>
                <select
                  {...register('contractType', { required: true })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Employment Status</label>
                <select
                  {...register('status')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="TERMINATED">Terminated</option>
                  <option value="RESIGNED">Resigned</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Hire Date<span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  {...register('hireDate', { required: 'Hire date is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {errors.hireDate && <p className="text-xs text-rose-600">{errors.hireDate.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Termination Date</label>
                <input
                  type="date"
                  {...register('terminationDate')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Salary<span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('salary', {
                    required: 'Salary is required',
                    valueAsNumber: true,
                    min: { value: 0, message: 'Salary must be zero or higher.' },
                  })}
                  placeholder="75000"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {errors.salary && <p className="text-xs text-rose-600">{errors.salary.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Currency</label>
                <select
                  {...register('salaryCurrency')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ALL">ALL</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Manager</label>
                <select
                  {...register('managerId')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">No manager assigned</option>
                  {managerOptions.map((employee: Employee) => {
                    const fullName = employee.user
                      ? `${employee.user.firstName} ${employee.user.lastName}`.trim()
                      : employee.employeeNumber;
                    return (
                      <option key={employee.id} value={employee.id}>
                        {fullName} — {employee.jobTitle}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Emergency Contact Name</label>
                <input
                  type="text"
                  {...register('emergencyContactName')}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Emergency Contact Phone</label>
                <input
                  type="tel"
                  {...register('emergencyContactPhone')}
                  placeholder="+1234567890"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                <input
                  type="text"
                  {...register('emergencyContactRelation')}
                  placeholder="Spouse"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Converting...' : 'Convert to Employee'}
            </button>
          </div>
        </form>
      </div>
      {successMessage && (
        <FeedbackToast
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          tone="success"
        />
      )}
    </div>
  );
}


