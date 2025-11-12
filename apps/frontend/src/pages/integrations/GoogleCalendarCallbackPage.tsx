import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { googleCalendarApi } from '@/lib/api/google-calendar';
import { useToast } from '@/components/ui/use-toast';

export default function GoogleCalendarCallbackPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const mutation = useMutation({
    mutationFn: (authCode: string) =>
      googleCalendarApi.exchangeCode({
        code: authCode,
        redirectUri: `${window.location.origin}${location.pathname}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar'] });
      toast({
        title: 'Google Calendar connected',
        description: 'Your events are now available inside the platform.',
      });
      navigate('/calendar', { replace: true });
    },
    onError: () => {
      toast({
        title: 'Could not connect Google Calendar',
        description: 'Please try again. If the problem persists, contact an administrator.',
        variant: 'destructive',
      });
      navigate('/calendar', { replace: true });
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Google sign-in was cancelled',
        description: error === 'access_denied' ? 'Permission was not granted.' : error,
        variant: 'destructive',
      });
      navigate('/calendar', { replace: true });
      return;
    }

    if (!code) {
      toast({
        title: 'Missing authorization code',
        description: 'We could not complete the Google Calendar connection.',
        variant: 'destructive',
      });
      navigate('/calendar', { replace: true });
      return;
    }

    mutation.mutate(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-12 text-center shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-300" />
        <div>
          <p className="text-lg font-semibold text-foreground">Connecting Google Calendar…</p>
          <p className="text-sm text-muted-foreground">
            You will be redirected once the connection completes.
          </p>
        </div>
      </div>
    </div>
  );
}


