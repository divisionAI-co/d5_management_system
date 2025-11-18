import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X, FileText, ChevronLeft, ExternalLink } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment';
import { googleDriveApi } from '@/lib/api/google-drive';
import { MentionInput } from '@/components/shared/MentionInput';
import type {
  Candidate,
  CandidateRecruiter,
  CandidateStage,
  CreateCandidateDto,
  UpdateCandidateDto,
} from '@/types/recruitment';
import { CANDIDATE_STAGE_LABELS, CANDIDATE_STAGE_ORDER } from './CandidateBoard';
import type { DriveFile } from '@/types/integrations';

type DrivePickerMode = 'resume' | 'folder';

interface DriveBreadcrumb {
  id: string | null;
  name: string;
}

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

  const [drivePickerState, setDrivePickerState] = useState<{
    mode: DrivePickerMode | null;
    currentFolderId: string | null;
    breadcrumbs: DriveBreadcrumb[];
  }>({
    mode: null,
    currentFolderId: null,
    breadcrumbs: [{ id: null, name: 'My Drive' }],
  });

  const driveFilesQuery = useQuery({
    queryKey: ['candidate-drive-picker', drivePickerState.currentFolderId],
    enabled: drivePickerOpen,
    queryFn: () =>
      googleDriveApi.listFiles({
        parentId: drivePickerState.currentFolderId ?? undefined,
        pageSize: 100,
      }),
  });

  const handleOpenDrivePicker = async (mode: DrivePickerMode) => {
    const startingFolderId = mode === 'resume' && resolvedDriveFolderId
      ? resolvedDriveFolderId
      : resolvedDriveFolderId ?? null;

    const baseBreadcrumbs: DriveBreadcrumb[] = [{ id: null, name: 'My Drive' }];
    if (startingFolderId) {
      baseBreadcrumbs.push({ id: startingFolderId, name: 'Selected folder' });
    }

    setDrivePickerState({
      mode,
      currentFolderId: startingFolderId ?? null,
      breadcrumbs: baseBreadcrumbs,
    });
    setDrivePickerOpen(true);

    if (startingFolderId) {
      try {
        const metadata = await googleDriveApi.getFile(startingFolderId);
        setDrivePickerState((prev) => ({
          ...prev,
          breadcrumbs: prev.breadcrumbs.map((crumb) =>
            crumb.id === startingFolderId
              ? { ...crumb, name: metadata.name ?? 'Selected folder' }
              : crumb,
          ),
        }));
      } catch (error) {
        // ignore metadata errors
      }
    }
  };

  const handleCloseDrivePicker = () => {
    setDrivePickerOpen(false);
    setDrivePickerState({ mode: null, currentFolderId: null, breadcrumbs: [{ id: null, name: 'My Drive' }] });
  };

  const handleSelectDriveFile = (file: DriveFile) => {
    const viewLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    setValue('resume', viewLink, { shouldDirty: true, shouldTouch: true });
    handleCloseDrivePicker();
  };

  const handleSelectDriveFolder = (folder: DriveFile) => {
    const folderLink = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
    setValue('driveFolderUrl', folderLink, { shouldDirty: true, shouldTouch: true });
    setValue('driveFolderId', folder.id, { shouldDirty: true, shouldTouch: true });
    handleCloseDrivePicker();
  };

  const handleUseCurrentFolder = () => {
    if (!drivePickerState.currentFolderId) {
      return;
    }
    const link = `https://drive.google.com/drive/folders/${drivePickerState.currentFolderId}`;
    setValue('driveFolderUrl', link, { shouldDirty: true, shouldTouch: true });
    setValue('driveFolderId', drivePickerState.currentFolderId, {
      shouldDirty: true,
      shouldTouch: true,
    });
    handleCloseDrivePicker();
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    setDrivePickerState((prev) => {
      const target = prev.breadcrumbs[index];
      return {
        ...prev,
        currentFolderId: target?.id ?? null,
        breadcrumbs: prev.breadcrumbs.slice(0, index + 1),
      };
    });
  };

  const handleEnterDriveFolder = (folder: DriveFile) => {
    setDrivePickerState((prev) => ({
      ...prev,
      currentFolderId: folder.id,
      breadcrumbs: [
        ...prev.breadcrumbs,
        {
          id: folder.id,
          name: folder.name || 'Untitled folder',
        },
      ],
    }));
  };

  const renderDrivePicker = () => {
    if (!drivePickerOpen || !drivePickerState.mode) {
      return null;
    }

    const isFolderMode = drivePickerState.mode === 'folder';
    const files = driveFilesQuery.data?.files ?? [];
    const lastBreadcrumbIndex = drivePickerState.breadcrumbs.length - 1;
    const currentFolderLink = drivePickerState.currentFolderId
      ? `https://drive.google.com/drive/folders/${drivePickerState.currentFolderId}`
      : 'https://drive.google.com/drive/u/0/my-drive';

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
        <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {isFolderMode ? 'Choose Google Drive Folder' : 'Select document'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isFolderMode
                  ? 'Navigate your Google Drive and pick the folder that stores candidate documents.'
                  : 'Choose a file from Google Drive to populate the resume link or replace it.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={currentFolderLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Drive
              </a>
              <button
                type="button"
                onClick={handleCloseDrivePicker}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {drivePickerState.breadcrumbs.map((breadcrumb, index) => (
                <span key={`${breadcrumb.id ?? 'root'}-${index}`} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleNavigateToBreadcrumb(index)}
                    disabled={index === lastBreadcrumbIndex}
                    className={`font-semibold transition ${
                      index === lastBreadcrumbIndex
                        ? 'cursor-default text-foreground'
                        : 'text-blue-600 hover:underline'
                    }`}
                  >
                    {index === 0 ? 'My Drive' : breadcrumb.name}
                  </button>
                  {index < lastBreadcrumbIndex && <span className="text-muted-foreground">/</span>}
                </span>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {drivePickerState.breadcrumbs.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleNavigateToBreadcrumb(Math.max(0, lastBreadcrumbIndex - 1))}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}
              {isFolderMode && drivePickerState.currentFolderId && (
                <button
                  type="button"
                  onClick={handleUseCurrentFolder}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Use this folder
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-5 py-6">
            {driveFilesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Google Drive…
              </div>
            ) : driveFilesQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-600">
                We couldn&apos;t load the Google Drive files right now. Please try again later.
              </div>
            ) : files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                This folder is empty. Navigate to a different location or upload files in Google Drive.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {files.map((file) => {
                  const modifiedLabel = file.modifiedTime
                    ? `Updated ${new Date(file.modifiedTime).toLocaleDateString()}`
                    : 'Last update unknown';
                  const isFolder = Boolean(file.isFolder);
                  const viewLink = isFolder
                    ? file.webViewLink || `https://drive.google.com/drive/folders/${file.id}`
                    : file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

                  return (
                    <div
                      key={file.id}
                      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-muted/30 transition hover:border-blue-500 hover:bg-blue-50/70"
                    >
                      <button
                        type="button"
                        onClick={() => window.open(viewLink, '_blank', 'noopener,noreferrer')}
                        className="group flex flex-col text-left"
                      >
                        <div className="aspect-video w-full overflow-hidden bg-muted">
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt={`${file.name} thumbnail`}
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                              <FileText className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-1 px-4 py-3">
                          <p className="line-clamp-2 text-sm font-semibold text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{modifiedLabel}</p>
                        </div>
                      </button>
                      <div className="flex items-center justify-between border-t border-border bg-card/70 px-4 py-3 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            isFolder ? handleEnterDriveFolder(file) : window.open(viewLink, '_blank', 'noopener,noreferrer')
                          }
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                          {isFolder ? 'Browse' : 'Open'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            isFolder ? handleSelectDriveFolder(file) : handleSelectDriveFile(file)
                          }
                          disabled={(isFolder && !isFolderMode) || (!isFolder && isFolderMode)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-semibold transition ${
                            (isFolder && !isFolderMode) || (!isFolder && isFolderMode)
                              ? 'cursor-not-allowed border border-border text-muted-foreground opacity-60'
                              : 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isFolder ? 'Select folder' : 'Use file'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
                        onClick={() => handleOpenDrivePicker('resume')}
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
      {renderDrivePicker()}
    </div>
  );
}


