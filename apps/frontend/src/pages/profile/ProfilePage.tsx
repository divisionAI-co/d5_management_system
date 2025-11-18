import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi } from '@/lib/api/users';
import { authApi, type TwoFactorSetupResponse } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UpdateProfilePayload, UserDetail } from '@/types/users';

type PersonalInfoFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  avatar: string;
  dateOfBirth: string;
};

type CredentialsFormValues = {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

const PERSONAL_DEFAULTS: PersonalInfoFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  avatar: '',
  dateOfBirth: '',
};

const CREDENTIAL_DEFAULTS: CredentialsFormValues = {
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

const formatDateInput = (value?: string | null) => {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const updateAuthUser = useAuthStore((state) => state.updateUser);

  const [personalFeedback, setPersonalFeedback] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [credentialFeedback, setCredentialFeedback] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('');
  const [twoFactorFeedback, setTwoFactorFeedback] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const profileQuery = useQuery<UserDetail>({
    queryKey: ['profile'],
    queryFn: usersApi.getProfile,
  });

  const personalForm = useForm<PersonalInfoFormValues>({
    defaultValues: PERSONAL_DEFAULTS,
  });

  const credentialsForm = useForm<CredentialsFormValues>({
    defaultValues: CREDENTIAL_DEFAULTS,
  });

  const profileData = profileQuery.data;

  useEffect(() => {
    if (!profileData) {
      return;
    }

    personalForm.reset({
      firstName: profileData.firstName ?? '',
      lastName: profileData.lastName ?? '',
      phone: profileData.phone ?? '',
      avatar: profileData.avatar ?? '',
      dateOfBirth: formatDateInput(profileData.dateOfBirth),
    });

    credentialsForm.reset({
      email: profileData.email ?? '',
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    });
  }, [profileData, personalForm, credentialsForm]);

  const personalMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => usersApi.updateProfile(payload),
    onSuccess: (updatedProfile: UserDetail) => {
      queryClient.setQueryData(['profile'], updatedProfile);
      updateAuthUser({
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        email: updatedProfile.email,
        twoFactorEnabled: updatedProfile.twoFactorEnabled,
      });
      setPersonalFeedback('Profile updated successfully.');
      setPersonalError(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        'We could not save your profile. Please check your inputs and try again.';
      setPersonalError(
        Array.isArray(message) ? message.join(' ') : String(message),
      );
      setPersonalFeedback(null);
    },
  });

  const credentialsMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => usersApi.updateProfile(payload),
    onSuccess: (updatedProfile: UserDetail) => {
      queryClient.setQueryData(['profile'], updatedProfile);
      updateAuthUser({
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        email: updatedProfile.email,
        twoFactorEnabled: updatedProfile.twoFactorEnabled,
      });
      credentialsForm.reset({
        email: updatedProfile.email,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setCredentialFeedback('Account details updated successfully.');
      setCredentialError(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        'We could not update your credentials. Please verify your information and try again.';
      setCredentialError(
        Array.isArray(message) ? message.join(' ') : String(message),
      );
      setCredentialFeedback(null);
    },
  });

  const generateTwoFactorMutation = useMutation({
    mutationFn: () => authApi.generateTwoFactorSecret(),
    onSuccess: (data) => {
      setTwoFactorSetup(data);
      setTwoFactorFeedback(
        'Scan the QR code with your authenticator app, then enter the 6-digit code to enable 2FA.',
      );
      setTwoFactorError(null);
      setTwoFactorCode('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Could not generate a 2FA secret.';
      setTwoFactorError(Array.isArray(message) ? message.join(' ') : String(message));
      setTwoFactorFeedback(null);
    },
  });

  const enableTwoFactorMutation = useMutation({
    mutationFn: (code: string) => authApi.enableTwoFactor(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      updateAuthUser({ twoFactorEnabled: true });
      setTwoFactorFeedback('Two-factor authentication is now enabled.');
      setTwoFactorError(null);
      setTwoFactorSetup(null);
      setTwoFactorCode('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'The verification code is invalid.';
      setTwoFactorError(Array.isArray(message) ? message.join(' ') : String(message));
      setTwoFactorFeedback(null);
    },
  });

  const disableTwoFactorMutation = useMutation({
    mutationFn: (code: string) => authApi.disableTwoFactor(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      updateAuthUser({ twoFactorEnabled: false });
      setTwoFactorFeedback('Two-factor authentication has been disabled.');
      setTwoFactorError(null);
      setTwoFactorDisableCode('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Unable to disable 2FA with that code.';
      setTwoFactorError(Array.isArray(message) ? message.join(' ') : String(message));
      setTwoFactorFeedback(null);
    },
  });

  useEffect(() => {
    if (profileData?.twoFactorEnabled) {
      setTwoFactorSetup(null);
      setTwoFactorCode('');
    } else {
      setTwoFactorDisableCode('');
    }
  }, [profileData?.twoFactorEnabled]);

  const isLoadingProfile = profileQuery.isLoading;

  const handlePersonalSubmit = personalForm.handleSubmit((values) => {
    setPersonalFeedback(null);
    setPersonalError(null);

    if (!profileData) {
      return;
    }

    const payload: UpdateProfilePayload = {};
    const trimmedFirstName = values.firstName.trim();
    const trimmedLastName = values.lastName.trim();
    const trimmedPhone = values.phone.trim();
    const trimmedAvatar = values.avatar.trim();
    const normalizedDob = values.dateOfBirth ? values.dateOfBirth : null;

    if (trimmedFirstName && trimmedFirstName !== profileData.firstName) {
      payload.firstName = trimmedFirstName;
    }

    if (trimmedLastName && trimmedLastName !== profileData.lastName) {
      payload.lastName = trimmedLastName;
    }

    const currentPhone = profileData.phone ?? null;
    const normalizedPhone = trimmedPhone ? trimmedPhone : null;
    if (currentPhone !== normalizedPhone) {
      payload.phone = normalizedPhone;
    }

    const currentAvatar = profileData.avatar ?? null;
    const normalizedAvatar = trimmedAvatar ? trimmedAvatar : null;
    if (currentAvatar !== normalizedAvatar) {
      payload.avatar = normalizedAvatar;
    }

    const currentDob = profileData.dateOfBirth
      ? formatDateInput(profileData.dateOfBirth)
      : null;
    if (currentDob !== normalizedDob) {
      payload.dateOfBirth = normalizedDob;
    }

    if (Object.keys(payload).length === 0) {
      setPersonalFeedback('No changes to save.');
      return;
    }

    personalMutation.mutate(payload);
  });

  const handleCredentialsSubmit = credentialsForm.handleSubmit((values) => {
    setCredentialFeedback(null);
    setCredentialError(null);

    if (!profileData) {
      return;
    }

    credentialsForm.clearErrors();

    const payload: UpdateProfilePayload = {};
    const trimmedEmail = values.email.trim().toLowerCase();
    const currentEmail = profileData.email.trim().toLowerCase();

    if (trimmedEmail && trimmedEmail !== currentEmail) {
      payload.email = trimmedEmail;
    }

    if (values.newPassword) {
      if (values.newPassword.length < 8) {
        credentialsForm.setError('newPassword', {
          type: 'minLength',
          message: 'New password must be at least 8 characters long.',
        });
        return;
      }

      if (!values.currentPassword) {
        credentialsForm.setError('currentPassword', {
          type: 'required',
          message: 'Enter your current password to set a new one.',
        });
        return;
      }

      if (values.newPassword !== values.confirmNewPassword) {
        credentialsForm.setError('confirmNewPassword', {
          type: 'validate',
          message: 'New passwords do not match.',
        });
        return;
      }

      payload.currentPassword = values.currentPassword;
      payload.newPassword = values.newPassword;
    }

    if (Object.keys(payload).length === 0) {
      setCredentialFeedback('No changes to save.');
      return;
    }

    credentialsMutation.mutate(payload);
  });

  const profileInitials = useMemo(() => {
    if (!profileData) {
      return '';
    }

    const firstInitial = profileData.firstName?.[0] ?? '';
    const lastInitial = profileData.lastName?.[0] ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }, [profileData]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Update your personal details and login credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
            {profileData?.avatar ? (
              <img
                src={profileData.avatar}
                alt="Profile avatar"
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              profileInitials || '?'
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {profileData?.firstName} {profileData?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{profileData?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
            <p className="text-sm text-muted-foreground">
              Keep your contact details up to date so your team can reach you easily.
            </p>
          </div>

          <form onSubmit={handlePersonalSubmit} className="space-y-4 px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  First name
                </label>
                <input
                  type="text"
                  {...personalForm.register('firstName', { required: 'First name is required.' })}
                  disabled={isLoadingProfile || personalMutation.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {personalForm.formState.errors.firstName && (
                  <p className="mt-1 text-xs text-red-600">
                    {personalForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Last name
                </label>
                <input
                  type="text"
                  {...personalForm.register('lastName', { required: 'Last name is required.' })}
                  disabled={isLoadingProfile || personalMutation.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {personalForm.formState.errors.lastName && (
                  <p className="mt-1 text-xs text-red-600">
                    {personalForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Phone number
                </label>
                <input
                  type="tel"
                  {...personalForm.register('phone')}
                  disabled={isLoadingProfile || personalMutation.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="+355 69 123 4567"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Date of birth
                </label>
                <input
                  type="date"
                  {...personalForm.register('dateOfBirth')}
                  disabled={isLoadingProfile || personalMutation.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Avatar URL
              </label>
              <input
                type="url"
                {...personalForm.register('avatar')}
                disabled={isLoadingProfile || personalMutation.isPending}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="https://example.com/avatar.png"
              />
            </div>

            {personalError && (
              <p className="text-sm text-red-600">
                {personalError}
              </p>
            )}

            {personalFeedback && !personalError && (
              <p className="text-sm text-green-600">{personalFeedback}</p>
            )}

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  if (profileData) {
                    personalForm.reset({
                      firstName: profileData.firstName ?? '',
                      lastName: profileData.lastName ?? '',
                      phone: profileData.phone ?? '',
                      avatar: profileData.avatar ?? '',
                      dateOfBirth: formatDateInput(profileData.dateOfBirth),
                    });
                  }
                  setPersonalFeedback(null);
                  setPersonalError(null);
                }}
                disabled={isLoadingProfile || personalMutation.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isLoadingProfile || personalMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {personalMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Login & Security</h2>
            <p className="text-sm text-muted-foreground">
              Change the email you use to sign in or update your password.
            </p>
          </div>

          <form onSubmit={handleCredentialsSubmit} className="space-y-4 px-6 py-6">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Email address
              </label>
              <input
                type="email"
                {...credentialsForm.register('email', {
                  required: 'Email is required.',
                })}
                disabled={isLoadingProfile || credentialsMutation.isPending}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {credentialsForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">
                  {credentialsForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Current password
                </label>
                <input
                  type="password"
                  {...credentialsForm.register('currentPassword')}
                  disabled={isLoadingProfile || credentialsMutation.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Required when changing password"
                />
                {credentialsForm.formState.errors.currentPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    {credentialsForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  New password
                </label>
                <input
                  type="password"
                  {...credentialsForm.register('newPassword')}
                  disabled={isLoadingProfile || credentialsMutation.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Minimum 8 characters"
                />
                {credentialsForm.formState.errors.newPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    {credentialsForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Confirm new password
              </label>
              <input
                type="password"
                {...credentialsForm.register('confirmNewPassword')}
                disabled={isLoadingProfile || credentialsMutation.isPending}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {credentialsForm.formState.errors.confirmNewPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {credentialsForm.formState.errors.confirmNewPassword.message}
                </p>
              )}
            </div>

            {credentialError && (
              <p className="text-sm text-red-600">
                {credentialError}
              </p>
            )}

            {credentialFeedback && !credentialError && (
              <p className="text-sm text-green-600">{credentialFeedback}</p>
            )}

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  if (profileData) {
                    credentialsForm.reset({
                      email: profileData.email ?? '',
                      currentPassword: '',
                      newPassword: '',
                      confirmNewPassword: '',
                    });
                  }
                  setCredentialFeedback(null);
                  setCredentialError(null);
                }}
                disabled={isLoadingProfile || credentialsMutation.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isLoadingProfile || credentialsMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {credentialsMutation.isPending ? 'Saving...' : 'Update Credentials'}
              </button>
            </div>
          </form>

          <div className="border-t border-border px-6 py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Two-Factor Authentication
                </h3>
                <p className="text-sm text-muted-foreground">
                  Secure your account by requiring a code from an authenticator app when signing in.
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  profileData?.twoFactorEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {profileData?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {!profileData?.twoFactorEnabled ? (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Use a TOTP compatible authenticator (Google Authenticator, 1Password, Authy, etc.)
                  to scan the QR code and enter the code generated by your app.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => generateTwoFactorMutation.mutate()}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={generateTwoFactorMutation.isPending || enableTwoFactorMutation.isPending}
                  >
                    {generateTwoFactorMutation.isPending ? 'Generating...' : 'Generate setup QR'}
                  </button>
                </div>

                {twoFactorSetup && (
                  <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
                    <div className="mx-auto flex items-center justify-center rounded-lg bg-card p-2 sm:mx-0">
                      <img
                        src={twoFactorSetup.qrCode}
                        alt="Two-factor authenticator QR code"
                        className="aspect-square max-w-full object-contain"
                        style={{ maxWidth: 'min(256px, 100%)', width: 'auto', height: 'auto' }}
                      />
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        Scan this QR code with your authenticator app. If you cannot scan it, use the
                        secret key below.
                      </p>
                      <div className="rounded-md border border-dashed border-border bg-card/60 p-3 font-mono text-sm text-foreground">
                        {twoFactorSetup.secret}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={twoFactorCode}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                      setTwoFactorCode(next);
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    disabled={
                      enableTwoFactorMutation.isPending ||
                      generateTwoFactorMutation.isPending ||
                      !twoFactorSetup
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => enableTwoFactorMutation.mutate(twoFactorCode)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      enableTwoFactorMutation.isPending ||
                      !twoFactorSetup ||
                      twoFactorCode.length !== 6
                    }
                  >
                    {enableTwoFactorMutation.isPending ? 'Enabling...' : 'Enable 2FA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorSetup(null);
                      setTwoFactorCode('');
                      setTwoFactorFeedback(null);
                      setTwoFactorError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    disabled={
                      enableTwoFactorMutation.isPending || generateTwoFactorMutation.isPending
                    }
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication is currently enabled. Enter a valid code from your
                  authenticator app to disable it.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Authenticator code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={twoFactorDisableCode}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                      setTwoFactorDisableCode(next);
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    disabled={disableTwoFactorMutation.isPending}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => disableTwoFactorMutation.mutate(twoFactorDisableCode)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      disableTwoFactorMutation.isPending || twoFactorDisableCode.length !== 6
                    }
                  >
                    {disableTwoFactorMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                </div>
              </div>
            )}

            {(twoFactorFeedback || twoFactorError) && (
              <div className="mt-6 space-y-2">
                {twoFactorFeedback && (
                  <p className="text-sm text-emerald-400">{twoFactorFeedback}</p>
                )}
                {twoFactorError && <p className="text-sm text-red-500">{twoFactorError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


