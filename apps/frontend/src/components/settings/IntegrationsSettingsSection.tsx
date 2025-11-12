import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { settingsApi } from '@/lib/api/settings';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import type {
  IntegrationSettings,
  UpdateIntegrationPayload,
} from '@/types/settings';

interface TogglePayload {
  name: string;
  payload: UpdateIntegrationPayload;
}

export function IntegrationsSettingsSection() {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: settingsApi.getIntegrations,
  });

  const mutation = useMutation({
    mutationFn: ({ name, payload }: TogglePayload) =>
      settingsApi.updateIntegration(name, payload),
    onSuccess: (updated: IntegrationSettings) => {
      queryClient.setQueryData<IntegrationSettings[] | undefined>(
        ['settings', 'integrations'],
        (previous) =>
          previous?.map((integration) =>
            integration.name === updated.name ? updated : integration,
          ),
      );
    },
  });

  const integrations = useMemo(
    () =>
      data?.map((integration) => ({
        ...integration,
        friendlyName: integration.displayName ?? integration.name,
        description:
          integration.description ??
          'Configure access and synchronisation for this integration.',
      })) ?? [],
    [data],
  );

  const handleToggle = (integration: IntegrationSettings) => {
    mutation.mutate({
      name: integration.name,
      payload: { isActive: !integration.isActive },
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect third-party services to keep data in sync.
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading integrations...</p>
        )}

        {!isLoading && integrations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No integrations configured yet.
          </p>
        )}

        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="flex flex-col gap-3 rounded-lg border border-border px-4 py-4 transition hover:bg-muted md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">
                {integration.friendlyName}
              </p>
              <p className="text-xs text-muted-foreground">
                {integration.description}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Status:{' '}
                <span className="font-medium text-muted-foreground">
                  {integration.isActive ? 'Enabled' : 'Disabled'}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleToggle(integration)}
              disabled={mutation.isPending || isFetching}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${
                integration.isActive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {mutation.isPending && mutation.variables?.name === integration.name
                ? 'Saving...'
                : integration.isActive
                ? 'Disable'
                : 'Enable'}
            </button>
          </div>
        ))}

        {mutation.isError && (
          <FeedbackToast
            message="Could not update integration. Please try again."
            onDismiss={() => mutation.reset()}
            tone="error"
          />
        )}
      </div>
    </div>
  );
}


