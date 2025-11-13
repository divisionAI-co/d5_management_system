import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { googleCalendarApi } from '@/lib/api/google-calendar';
import { googleDriveApi } from '@/lib/api/google-drive';
import { useToast } from '@/components/ui/use-toast';

export default function GoogleOAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state'); // Integration name: 'google_calendar' or 'google_drive'

  // Determine which integration based on state
  // Default to calendar if state is missing (backward compatibility)
  const integration = state === 'google_drive' ? 'drive' : 'calendar';

  // Debug logging
  useEffect(() => {
    console.log('GoogleOAuthCallbackPage mounted', { code: !!code, error, state, integration });
  }, [code, error, state, integration]);

  const calendarMutation = useMutation({
    mutationFn: (authCode: string) =>
      googleCalendarApi.exchangeCode({
        code: authCode,
        redirectUri: `${window.location.origin}/integrations/google/callback`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      toast({
        title: 'Google Calendar connected',
        description: 'Your events are now available inside the platform.',
      });
      // Use setTimeout to ensure toast is shown before navigation
      setTimeout(() => {
        navigate('/calendar', { replace: true });
      }, 100);
    },
    onError: (error: any) => {
      console.error('Google Calendar connection error:', error);
      toast({
        title: 'Could not connect Google Calendar',
        description: error?.response?.data?.message || 'Please try again. If the problem persists, contact an administrator.',
        variant: 'destructive',
      });
      setTimeout(() => {
        navigate('/calendar', { replace: true });
      }, 100);
    },
  });

  const driveMutation = useMutation({
    mutationFn: (authCode: string) =>
      googleDriveApi.exchangeCode(authCode, `${window.location.origin}/integrations/google/callback`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-status'] });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      toast({
        title: 'Google Drive connected',
        description: 'You can now access your Google Drive files.',
      });
      navigate('/settings/integrations', { replace: true });
    },
    onError: () => {
      toast({
        title: 'Could not connect Google Drive',
        description: 'Please try again. If the problem persists, contact an administrator.',
        variant: 'destructive',
      });
      navigate('/settings/integrations', { replace: true });
    },
  });

  useEffect(() => {
    console.log('Processing OAuth callback', { code: !!code, error, state, integration, url: window.location.href });
    
    // Only process once
    if (!code && !error) {
      console.log('No code or error yet, waiting...');
      return; // Wait for code or error
    }

    if (error) {
      const errorMessage = error === 'access_denied' ? 'Permission was not granted.' : error;
      console.log('OAuth error:', errorMessage);
      toast({
        title: 'Google sign-in was cancelled',
        description: errorMessage,
        variant: 'destructive',
      });
      const targetPath = integration === 'drive' ? '/settings/integrations' : '/calendar';
      console.log('Navigating to:', targetPath);
      navigate(targetPath, { replace: true });
      return;
    }

    if (!code) {
      console.log('No authorization code received');
      toast({
        title: 'Missing authorization code',
        description: `We could not complete the Google ${integration === 'drive' ? 'Drive' : 'Calendar'} connection.`,
        variant: 'destructive',
      });
      const targetPath = integration === 'drive' ? '/settings/integrations' : '/calendar';
      console.log('Navigating to:', targetPath);
      navigate(targetPath, { replace: true });
      return;
    }

    // Process the OAuth code
    console.log('Processing OAuth code for:', integration);
    if (integration === 'drive') {
      driveMutation.mutate(code);
    } else {
      calendarMutation.mutate(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, error, state]);

  const integrationName = integration === 'drive' ? 'Google Drive' : 'Google Calendar';

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-8 py-12 text-center shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-300" />
        <div>
          <p className="text-lg font-semibold text-foreground">Connecting {integrationName}…</p>
          <p className="text-sm text-muted-foreground">
            You will be redirected once the connection completes.
          </p>
        </div>
      </div>
    </div>
  );
}

