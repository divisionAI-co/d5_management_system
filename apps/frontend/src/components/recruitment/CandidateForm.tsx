import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment';
import type {
  Candidate,
  CandidateStage,
  CreateCandidateDto,
  UpdateCandidateDto,
} from '@/types/recruitment';
import { CANDIDATE_STAGE_LABELS, CANDIDATE_STAGE_ORDER } from './CandidateBoard';

interface CandidateFormProps {
  candidate?: Candidate;
  onClose: () => void;
  onSuccess?: (candidate: Candidate) => void;
}

const DEFAULT_FORM_VALUES: CreateCandidateDto = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentTitle: '',
  yearsOfExperience: undefined,
  skills: [],
  stage: CANDIDATE_STAGE_ORDER[0],
  rating: undefined,
  notes: '',
  city: '',
  country: '',
  availableFrom: '',
  expectedSalary: undefined,
  salaryCurrency: 'USD',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  resume: '',
};

export function CandidateForm({ candidate, onClose, onSuccess }: CandidateFormProps) {
  const isEdit = Boolean(candidate);
  const queryClient = useQueryClient();

  const initialValues: CreateCandidateDto = useMemo(() => {
    if (!candidate) {
      return DEFAULT_FORM_VALUES;
    }

    return {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      currentTitle: candidate.currentTitle ?? '',
      yearsOfExperience: candidate.yearsOfExperience ?? undefined,
      skills: candidate.skills ?? [],
      stage: candidate.stage,
      rating: candidate.rating ?? undefined,
      notes: candidate.notes ?? '',
      city: candidate.city ?? '',
      country: candidate.country ?? '',
      availableFrom: candidate.availableFrom
        ? candidate.availableFrom.split('T')[0]
        : '',
      expectedSalary: candidate.expectedSalary ?? undefined,
      salaryCurrency: candidate.salaryCurrency ?? 'USD',
      linkedinUrl: candidate.linkedinUrl ?? '',
      githubUrl: candidate.githubUrl ?? '',
      portfolioUrl: candidate.portfolioUrl ?? '',
      resume: candidate.resume ?? '',
    };
  }, [candidate]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCandidateDto | UpdateCandidateDto>({
    defaultValues: initialValues,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCandidateDto) => candidatesApi.create(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      onSuccess?.(created);
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateCandidateDto) =>
      candidatesApi.update(candidate!.id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate', candidate!.id] });
      onSuccess?.(updated);
      onClose();
    },
  });

  const onSubmit = (payload: any) => {
    const normalizedSkills = Array.isArray(payload.skills)
      ? payload.skills
      : typeof payload.skills === 'string' && payload.skills.length > 0
      ? payload.skills.split(',').map((skill: string) => skill.trim()).filter(Boolean)
      : [];

    const dto: CreateCandidateDto | UpdateCandidateDto = {
      ...payload,
      skills: normalizedSkills,
    };

    if (!dto.stage) {
      dto.stage = CANDIDATE_STAGE_ORDER[0];
    }

    if (isEdit) {
      updateMutation.mutate(dto);
    } else {
      createMutation.mutate(dto as CreateCandidateDto);
    }
  };

  const formStage = watch('stage') as CandidateStage | undefined;
  const skillsValue = watch('skills');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Candidate' : 'Add New Candidate'}
            </h2>
            <p className="text-sm text-gray-500">
              Capture candidate contact details, experience and recruitment stage.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-2">
          <section className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                First Name *
              </label>
              <input
                type="text"
                {...register('firstName', { required: 'First name is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Jane"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Last Name *
              </label>
              <input
                type="text"
                {...register('lastName', { required: 'Last name is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="jane.doe@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="+355 68 123 4567"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Current Title
                </label>
                <input
                  type="text"
                  {...register('currentTitle')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Senior Full-Stack Engineer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Years of Experience
                </label>
                <input
                  type="number"
                  min={0}
                  {...register('yearsOfExperience', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="6"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Rating (1-5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  {...register('rating', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="4"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Skills (comma separated)
              </label>
              <input
                type="text"
                value={Array.isArray(skillsValue) ? skillsValue.join(', ') : skillsValue ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setValue(
                    'skills',
                    value
                      .split(',')
                      .map((skill) => skill.trim())
                      .filter(Boolean),
                  );
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="React, Node.js, GraphQL"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                rows={4}
                {...register('notes')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Relevant interview notes, expectations, etc."
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Stage
                </label>
                <select
                  value={formStage ?? CANDIDATE_STAGE_ORDER[0]}
                  {...register('stage')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {CANDIDATE_STAGE_ORDER.map((stage) => (
                    <option key={stage} value={stage}>
                      {CANDIDATE_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Available From
                </label>
                <input
                  type="date"
                  {...register('availableFrom')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Expected Salary
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  {...register('expectedSalary', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="60000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Currency
                </label>
                <input
                  type="text"
                  {...register('salaryCurrency')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="USD"
                  maxLength={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  LinkedIn
                </label>
                <input
                  type="url"
                  {...register('linkedinUrl')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="https://www.linkedin.com/in/jane-doe"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  GitHub
                </label>
                <input
                  type="url"
                  {...register('githubUrl')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="https://github.com/janedoe"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Portfolio
                </label>
                <input
                  type="url"
                  {...register('portfolioUrl')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="https://janedoe.dev"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Resume URL
                </label>
                <input
                  type="url"
                  {...register('resume')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="https://drive.google.com/.../resume.pdf"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  {...register('city')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Tirana"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  {...register('country')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Albania"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-gray-200 py-4 lg:col-span-2 lg:flex-row lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit
                ? 'Save Changes'
                : 'Create Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


