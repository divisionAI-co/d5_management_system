import { useState, useEffect } from 'react';
import { dataCleanupApi } from '@/lib/api/data-cleanup';
import { Trash2, AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';

export default function DataCleanupPage() {
  const [counts, setCounts] = useState<{
    contacts: number;
    leads: number;
    opportunities: number;
    total: number;
  } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    success: boolean;
    message: string;
    results: {
      opportunities: number;
      leads: number;
      contacts: number;
      errors: string[];
    };
    error?: string;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadCounts = async () => {
    setIsLoadingCounts(true);
    try {
      const data = await dataCleanupApi.getCounts();
      setCounts(data);
    } catch (error: any) {
      console.error('Failed to load counts:', error);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const handleCleanup = async () => {
    setShowConfirm(false);
    setIsCleaning(true);
    setCleanupResult(null);

    try {
      const result = await dataCleanupApi.cleanupCrm();
      setCleanupResult(result);
      if (result.success) {
        // Reload counts after successful cleanup
        await loadCounts();
      }
    } catch (error: any) {
      setCleanupResult({
        success: false,
        message: error.response?.data?.message || 'Failed to clean up CRM data',
        results: {
          opportunities: 0,
          leads: 0,
          contacts: 0,
          errors: [error.response?.data?.message || 'Unknown error'],
        },
        error: error.response?.data?.message || 'Unknown error',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Cleanup</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Clean up CRM data (contacts, leads, and opportunities) before reimporting.
        </p>
      </div>

      {/* Current Data Counts */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Current Data Counts
            </h2>
            <p className="text-sm text-muted-foreground">
              View the current number of records in the CRM system.
            </p>
          </div>
          <button
            onClick={loadCounts}
            disabled={isLoadingCounts}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingCounts ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            )}
          </button>
        </div>
        <div className="px-6 py-6">
          {isLoadingCounts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : counts ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Contacts</div>
                <div className="text-2xl font-bold text-foreground mt-1">{counts.contacts}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Leads</div>
                <div className="text-2xl font-bold text-foreground mt-1">{counts.leads}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium text-muted-foreground">Opportunities</div>
                <div className="text-2xl font-bold text-foreground mt-1">{counts.opportunities}</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Total</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {counts.total}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load data counts
            </div>
          )}
        </div>
      </div>

      {/* Cleanup Section */}
      <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 shadow-sm">
        <div className="border-b border-red-200 dark:border-red-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Clean Up CRM Data
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            Permanently delete all contacts, leads, and opportunities from the system.
          </p>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div className="rounded-lg border border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-800/30 px-4 py-3">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
                  ⚠️ WARNING: This action cannot be undone!
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                  This will permanently delete all contacts, leads, and opportunities from the database.
                  Related data such as activities, open positions, and other linked records will also be
                  removed. This action is irreversible. Only use this before reimporting data.
                </p>
              </div>
            </div>
          </div>

          {cleanupResult && (
            <div
              className={`rounded-lg border px-4 py-3 ${
                cleanupResult.success
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}
            >
              <div className="flex gap-3">
                {cleanupResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3
                    className={`text-sm font-semibold ${
                      cleanupResult.success
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}
                  >
                    {cleanupResult.success ? 'Cleanup Successful' : 'Cleanup Failed'}
                  </h3>
                  <div
                    className={`text-sm mt-1 space-y-2 ${
                      cleanupResult.success
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    <p>{cleanupResult.message}</p>
                    {cleanupResult.results && (
                      <div className="mt-3 space-y-1">
                        <p className="font-semibold">Deleted Records:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Opportunities: {cleanupResult.results.opportunities}</li>
                          <li>Leads: {cleanupResult.results.leads}</li>
                          <li>Contacts: {cleanupResult.results.contacts}</li>
                        </ul>
                      </div>
                    )}
                    {cleanupResult.results?.errors && cleanupResult.results.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="font-semibold">Errors:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          {cleanupResult.results.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {cleanupResult.error && (
                      <p className="mt-2 font-semibold">Error: {cleanupResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isCleaning || (counts?.total ?? 0) === 0}
              className="w-full inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {counts?.total === 0 ? 'No Data to Clean' : 'Clean Up CRM Data'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-800/30 px-4 py-3">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                  Are you absolutely sure?
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">
                  This will delete:
                  <br />• {counts?.opportunities ?? 0} opportunities
                  <br />• {counts?.leads ?? 0} leads
                  <br />• {counts?.contacts ?? 0} contacts
                  <br />
                  <br />
                  This action cannot be undone. Type "DELETE" to confirm.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isCleaning}
                  className="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCleanup}
                  disabled={isCleaning}
                  className="flex-1 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCleaning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cleaning Up...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Confirm Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

