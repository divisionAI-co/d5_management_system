import { IntegrationsSettingsSection } from '@/components/settings/IntegrationsSettingsSection';

export default function IntegrationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect and configure third-party services used across the organization.
        </p>
      </div>

      <IntegrationsSettingsSection />
    </div>
  );
}


