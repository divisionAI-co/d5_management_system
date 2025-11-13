import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/lib/stores/auth-store';

// Layouts
import AuthLayout from '@/components/layout/AuthLayout';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage';
import TwoFactorPage from '@/pages/auth/TwoFactorPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';

// Dashboard
import DashboardPage from '@/pages/dashboard/DashboardPage';
import CalendarPage from '@/pages/calendar/CalendarPage';

// CRM
import CustomersPage from '@/pages/crm/CustomersPage';
import CustomerDetailPage from '@/pages/crm/CustomerDetailPage';
import ContactsPage from '@/pages/crm/ContactsPage';
import LeadsPage from '@/pages/crm/LeadsPage';
import LeadDetailPage from '@/pages/crm/LeadDetailPage';
import OpportunitiesPage from '@/pages/crm/OpportunitiesPage';
import OpportunityDetailPage from '@/pages/crm/OpportunityDetailPage';
import CampaignsPage from '@/pages/crm/CampaignsPage';

// Recruitment
import CandidatesPage from '@/pages/recruitment/CandidatesPage';
import CandidateDetailPage from '@/pages/recruitment/CandidateDetailPage';
import OpenPositionsPage from '@/pages/recruitment/OpenPositionsPage';

// Employees & HR
import EmployeesPage from '@/pages/employees/EmployeesPage';
import EmployeeDetailPage from '@/pages/employees/EmployeeDetailPage';
import EodReportsPage from '@/pages/employees/EodReportsPage';
import LeaveRequestsPage from '@/pages/employees/LeaveRequestsPage';
import PerformanceReviewsPage from '@/pages/employees/PerformanceReviewsPage';
import RemoteWorkPage from '@/pages/employees/RemoteWorkPage';
import HolidaysPage from '@/pages/settings/HolidaysPage';

// Tasks
import TasksPage from '@/pages/tasks/TasksPage';

// Invoices
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetailPage';

// Documents
import DocumentsPage from '@/pages/documents/DocumentsPage';

// Settings
import SettingsPage from '@/pages/settings/SettingsPage';
import CompanySettingsPage from '@/pages/settings/CompanySettingsPage';
import NotificationSettingsPage from '@/pages/settings/NotificationSettingsPage';
import IntegrationsSettingsPage from '@/pages/settings/IntegrationsSettingsPage';
import AppearanceSettingsPage from '@/pages/settings/AppearanceSettingsPage';
import TemplatesPage from '@/pages/settings/TemplatesPage';
import ActivityTypesPage from '@/pages/settings/ActivityTypesPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import GoogleOAuthCallbackPage from '@/pages/integrations/GoogleOAuthCallbackPage';
import AiActionsPage from '@/pages/settings/AiActionsPage';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="2fa" element={<TwoFactorPage />} />
        </Route>

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* CRM */}
          <Route path="crm">
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route path="opportunities" element={<OpportunitiesPage />} />
            <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
          </Route>

          {/* Recruitment */}
          <Route path="recruitment">
            <Route path="candidates" element={<CandidatesPage />} />
            <Route path="candidates/:id" element={<CandidateDetailPage />} />
            <Route path="positions" element={<OpenPositionsPage />} />
          </Route>

          {/* Employees */}
          <Route path="employees">
            <Route index element={<EmployeesPage />} />
            <Route path=":id" element={<EmployeeDetailPage />} />
            <Route path="eod-reports" element={<EodReportsPage />} />
            <Route path="leave-requests" element={<LeaveRequestsPage />} />
            <Route path="performance-reviews" element={<PerformanceReviewsPage />} />
            <Route path="remote-work" element={<RemoteWorkPage />} />
          </Route>

          {/* Tasks */}
          <Route path="tasks" element={<TasksPage />} />

          {/* Documents */}
          <Route path="documents" element={<DocumentsPage />} />

          {/* Invoices */}
          <Route path="invoices">
            <Route index element={<InvoicesPage />} />
            <Route path=":id" element={<InvoiceDetailPage />} />
          </Route>

          {/* Settings */}
          <Route path="settings">
            <Route index element={<SettingsPage />} />
            <Route path="company" element={<CompanySettingsPage />} />
            <Route path="notifications" element={<NotificationSettingsPage />} />
            <Route path="appearance" element={<AppearanceSettingsPage />} />
            <Route path="integrations" element={<IntegrationsSettingsPage />} />
            <Route path="holidays" element={<HolidaysPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="activity-types" element={<ActivityTypesPage />} />
            <Route path="ai-actions" element={<AiActionsPage />} />
          </Route>

          {/* OAuth Callbacks - must be before catch-all routes */}
          <Route
            path="integrations/google/callback"
            element={<GoogleOAuthCallbackPage />}
          />
        </Route>

        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </BrowserRouter>
  );
}

export default App;

