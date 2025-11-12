import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/api/client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const disableSubmit = useMemo(() => {
    if (submitting || !password || !confirmPassword) {
      return true;
    }

    if (password !== confirmPassword) {
      return true;
    }

    if (password.length < 8) {
      return true;
    }

    return false;
  }, [confirmPassword, password, submitting]);

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disableSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/auth/password-reset/complete', {
        token,
        password,
      });

      setSuccessMessage('Your password has been reset. Redirecting to the sign in page...');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate('/auth/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to reset password. Please request a new link and try again.';
      setError(typeof message === 'string' ? message : 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-background shadow rounded-lg px-6 py-8">
          <h2 className="text-center text-3xl font-bold text-foreground">Reset Your Password</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Choose a new password to regain access to your account.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-background text-foreground"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting || !!successMessage}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-background text-foreground"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={submitting || !!successMessage}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={disableSubmit || !!successMessage}
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <span>Remembered your password?</span>{' '}
          <Link className="text-blue-600 hover:text-blue-500 font-medium" to="/auth/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

