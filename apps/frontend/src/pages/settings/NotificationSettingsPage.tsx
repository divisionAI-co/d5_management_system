import { NotificationPreferencesForm } from '@/components/settings/NotificationPreferencesForm';

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notification Preferences</h1>
        <p className="text-sm text-gray-600">
          Choose how you receive alerts for tasks, HR updates, and pipeline events.
        </p>
      </div>

      <NotificationPreferencesForm />
    </div>
  );
}


