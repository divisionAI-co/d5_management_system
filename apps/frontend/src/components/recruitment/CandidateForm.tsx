import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment';
import { MentionInput } from '@/components/shared/MentionInput';
import { DrivePicker, type DrivePickerMode } from '@/components/shared/DrivePicker';
import type {
  Candidate,
  CandidateRecruiter,
  CandidateStage,
  CreateCandidateDto,
  UpdateCandidateDto,
} from '@/types/recruitment';
import { CANDIDATE_STAGE_LABELS, CANDIDATE_STAGE_ORDER } from './CandidateBoard';
import type { DriveFile } from '@/types/integrations';

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
  driveFolderId: '',
  driveFolderUrl: '',
  isActive: true,
  recruiterId: '',
};

export function CandidateForm({ candidate, onClose, onSuccess }: CandidateFormProps) {
  const isEdit = Boolean(candidate);
  const queryClient = useQueryClient();
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [drivePickerMode, setDrivePickerMode] = useState<DrivePickerMode>('folder');
  const recruitersQuery = useQuery({
    queryKey: ['candidate-recruiters', 'form'],
    queryFn: () => candidatesApi.listRecruiters(),
    staleTime: 5 * 60 * 1000,
  });
  const recruiterOptions: CandidateRecruiter[] = recruitersQuery.data ?? [];

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
      driveFolderId: candidate.driveFolderId ?? '',
      driveFolderUrl: candidate.driveFolderUrl ?? '',
      isActive: candidate.isActive ?? true,
      recruiterId: candidate.recruiter?.id ?? '',
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

    const trimToUndefined = (value?: unknown) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return value === '' ? undefined : value;
    };

    const optionalStringFields: (keyof (CreateCandidateDto & UpdateCandidateDto))[] = [
      'phone',
      'currentTitle',
      'notes',
      'city',
      'country',
      'availableFrom',
      'salaryCurrency',
      'linkedinUrl',
      'githubUrl',
      'portfolioUrl',
      'resume',
      'recruiterId',
    ];

    optionalStringFields.forEach((field) => {
      const value = dto[field];
      if (value !== undefined) {
        // @ts-expect-error dynamic assignment for sanitizing optional strings
        dto[field] = trimToUndefined(value);
      }
    });

    // Handle driveFolderId and driveFolderUrl separately to allow clearing them
    // Empty strings should be sent as empty strings (not undefined) so backend can clear the field
    if ('driveFolderId' in dto) {
      const value = dto.driveFolderId;
      if (value !== undefined) {
        dto.driveFolderId = typeof value === 'string' && value.trim().length === 0 ? '' : value;
      }
    }
    if ('driveFolderUrl' in dto) {
      const value = dto.driveFolderUrl;
      if (value !== undefined) {
        dto.driveFolderUrl = typeof value === 'string' && value.trim().length === 0 ? '' : value;
      }
    }

    if (dto.availableFrom && dto.availableFrom.length === 0) {
      dto.availableFrom = undefined;
    }

    if (dto.expectedSalary === null || Number.isNaN(dto.expectedSalary as number)) {
      dto.expectedSalary = undefined;
    }

    if (isEdit) {
      updateMutation.mutate(dto);
    } else {
      createMutation.mutate(dto as CreateCandidateDto);
    }
  };

  const formStage = watch('stage') as CandidateStage | undefined;
  const skillsValue = watch('skills');
  const driveFolderIdValue = watch('driveFolderId') as string | undefined;
  const recruiterValue = watch('recruiterId') as string | undefined;
  // const driveFolderUrlValue = watch('driveFolderUrl');
  const resolvedDriveFolderId = driveFolderIdValue && driveFolderIdValue.trim().length > 0
    ? driveFolderIdValue.trim()
    : candidate?.driveFolderId ?? undefined;

  const handleOpenDrivePicker = (mode: DrivePickerMode) => {
    setDrivePickerMode(mode);
    setDrivePickerOpen(true);
  };

  const handleSelectDriveFile = (file: DriveFile) => {
    const viewLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    setValue('resume', viewLink, { shouldDirty: true, shouldTouch: true });
  };

  const handleSelectDriveFolder = (folder: DriveFile) => {
    const folderLink = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
    setValue('driveFolderUrl', folderLink, { shouldDirty: true, shouldTouch: true });
    setValue('driveFolderId', folder.id, { shouldDirty: true, shouldTouch: true });
  };

  const handleUseCurrentFolder = (folderId: string) => {
    const link = `https://drive.google.com/drive/folders/${folderId}`;
    setValue('driveFolderUrl', link, { shouldDirty: true, shouldTouch: true });
    setValue('driveFolderId', folderId, { shouldDirty: true, shouldTouch: true });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-4rem)]">
          <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {isEdit ? 'Edit Candidate' : 'Add New Candidate'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Capture candidate contact details, experience and recruitment stage.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted/70 hover:text-muted-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col min-h-0">
            <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-2 min-h-0">
              <section className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register('firstName', { required: 'First name is required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Jane"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    {...register('lastName', { required: 'Last name is required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Doe"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Email *
                  </label>
                  <input
                    type="email"
                    {...register('email', { required: 'Email is required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="jane.doe@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Phone
                    </label>
                    <input
                      type="tel"
                      {...register('phone')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="+355 68 123 4567"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Current Title
                    </label>
                    <input
                      type="text"
                      {...register('currentTitle')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="Senior Full-Stack Engineer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      {...register('yearsOfExperience', { valueAsNumber: true })}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="6"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Rating (1-5)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      {...register('rating', { valueAsNumber: true })}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="4"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
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
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="React, Node.js, GraphQL"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Notes
                  </label>
                  <MentionInput
                    value={watch('notes') || ''}
                    onChange={(value) => setValue('notes', value)}
                    rows={4}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Relevant interview notes, expectations, etc. Type @ to mention someone"
                  />
                </div>
              </section>
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Stage
                    </label>
                    <select
                      value={formStage ?? CANDIDATE_STAGE_ORDER[0]}
                      {...register('stage')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      {CANDIDATE_STAGE_ORDER.map((stage) => (
                        <option key={stage} value={stage}>
                          {CANDIDATE_STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Available From
                    </label>
                    <input
                      type="date"
                      {...register('availableFrom')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Recruiter
                  </label>
                  <select
                    value={recruiterValue ?? ''}
                    onChange={(event) =>
                      setValue('recruiterId', event.target.value, {
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">
                      {recruitersQuery.isLoading ? 'Loading recruiters…' : 'Unassigned'}
                    </option>
                    {recruiterOptions.map((recruiter) => (
                      <option key={recruiter.id} value={recruiter.id}>
                        {recruiter.firstName} {recruiter.lastName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assign the recruiter responsible for shepherding this candidate.
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <input
                    id="is-active"
                    type="checkbox"
                    {...register('isActive')}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="is-active"
                    className="flex-1 text-sm font-medium text-muted-foreground"
                  >
                    Active Candidate
                    <span className="ml-2 text-xs text-muted-foreground/70">
                      (Active candidates are visible in the board by default)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Expected Salary
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      {...register('expectedSalary', { valueAsNumber: true })}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="60000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Currency
                    </label>
                    <input
                      type="text"
                      {...register('salaryCurrency')}
                      className="w-full rounded-lg border border-border px-3 py-2 uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="USD"
                      maxLength={3}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      LinkedIn
                    </label>
                    <input
                      type="url"
                      {...register('linkedinUrl')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="https://www.linkedin.com/in/jane-doe"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      GitHub
                    </label>
                    <input
                      type="url"
                      {...register('githubUrl')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="https://github.com/janedoe"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Portfolio
                    </label>
                    <input
                      type="url"
                      {...register('portfolioUrl')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="https://janedoe.dev"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
                      <label htmlFor="candidate-resume-url" className="text-sm font-medium text-muted-foreground">
                        Resume URL
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOpenDrivePicker('file')}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Choose from Drive
                      </button>
                    </div>
                    <input
                      type="url"
                      id="candidate-resume-url"
                      {...register('resume')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="https://drive.google.com/.../resume.pdf"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {resolvedDriveFolderId
                        ? 'Pick a document from the connected Google Drive folder or paste any shareable link.'
                        : 'Paste the direct file link from Google Drive. The picker will open the folder link (or My Drive) so you can copy it.'}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="candidate-drive-folder-url" className="text-sm font-medium text-muted-foreground">
                        Google Drive Folder (ID or share link)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOpenDrivePicker('folder')}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Choose from Drive
                      </button>
                    </div>
                    <input
                      type="text"
                      id="candidate-drive-folder-url"
                      {...register('driveFolderUrl')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="https://drive.google.com/drive/folders/1A2b3C4D5..."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Paste the shared folder link or ID that stores interviews, CVs, and other candidate files.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      City
                    </label>
                    <input
                      type="text"
                      {...register('city')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="Tirana"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Country
                    </label>
                    <input
                      type="text"
                      {...register('country')}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder="Albania"
                    />
                  </div>
                </div>
              </section>
            </div>
            <div className="border-t border-border bg-muted/40 px-4 py-4 sm:px-6 flex-shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Fields marked with * are required. Use the skills input to record the candidate's core capabilities.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {isEdit
                      ? updateMutation.isPending
                        ? 'Saving…'
                        : 'Save Changes'
                      : createMutation.isPending
                      ? 'Creating…'
                      : 'Create Candidate'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      <DrivePicker
        open={drivePickerOpen}
        mode={drivePickerMode}
        initialFolderId={resolvedDriveFolderId}
        title={drivePickerMode === 'folder' ? 'Choose Google Drive Folder' : 'Select Resume File'}
        description={
          drivePickerMode === 'folder'
            ? 'Navigate your Google Drive and pick the folder that stores candidate documents.'
            : 'Choose a file from Google Drive to populate the resume link or replace it.'
        }
        onClose={() => setDrivePickerOpen(false)}
        onSelectFile={handleSelectDriveFile}
        onSelectFolder={handleSelectDriveFolder}
        onUseCurrentFolder={handleUseCurrentFolder}
      />
    </div>
  );
}


