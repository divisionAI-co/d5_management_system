import { DriveBrowser } from '@/components/integrations/drive/DriveBrowser';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
      <p className="text-sm text-muted-foreground">
        Access and manage shared files directly from Google Drive without leaving the platform.
      </p>

      <DriveBrowser />
    </div>
  );
}


