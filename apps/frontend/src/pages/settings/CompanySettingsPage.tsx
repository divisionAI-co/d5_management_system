import { CompanySettingsForm } from '@/components/settings/CompanySettingsForm';

export default function CompanySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Policies</h1>
        <p className="text-sm text-gray-600">
          Manage remote work allowances, EOD submission rules, and performance review cadence.
        </p>
      </div>

      <CompanySettingsForm />
    </div>
  );
}


