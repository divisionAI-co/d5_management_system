import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  TrendingUp,
  Users,
  Briefcase,
  ClipboardList,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/lib/api/dashboard';
import type { AdminDashboardResponse } from '@/types/dashboard';
import {
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery<AdminDashboardResponse>({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardApi.getAdmin(),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <h2 className="text-lg font-semibold">Unable to load admin dashboard</h2>
        <p className="mt-2 text-sm">Please refresh the page or try again later.</p>
      </div>
    );
  }

  const { kpis, financial, crm, hr, recruitment, tasks, alerts, recentActivities } = data;

  // Prepare chart data
  const monthlyRevenueData = financial.monthlyRevenue.map((item) => ({
    month: format(new Date(item.month + '-01'), 'MMM yyyy'),
    revenue: item.revenue,
  }));

  const customerStatusData = Object.entries(crm.customerStatus).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
  }));

  const tasksByStatusData = Object.entries(tasks.tasksByStatus).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
  }));


  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Company-wide overview and metrics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Last updated: {format(new Date(), 'MMM dd, yyyy HH:mm')}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Monthly Recurring Revenue"
          value={formatCurrency(kpis.mrr)}
          icon={<DollarSign className="h-5 w-5" />}
          trend={null}
          color="blue"
        />
        <KPICard
          title="Active Customers"
          value={formatNumber(kpis.activeCustomers)}
          icon={<Building2 className="h-5 w-5" />}
          trend={null}
          color="green"
        />
        <KPICard
          title="Active Employees"
          value={formatNumber(kpis.activeEmployees)}
          icon={<Users className="h-5 w-5" />}
          trend={null}
          color="purple"
        />
        <KPICard
          title="EOD Compliance"
          value={formatPercentage(kpis.eodComplianceRate)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          trend={kpis.eodComplianceRate >= 90 ? 'up' : 'down'}
          color={kpis.eodComplianceRate >= 90 ? 'green' : 'red'}
        />
        <KPICard
          title="Outstanding Invoices"
          value={formatCurrency(kpis.outstandingInvoices.value)}
          subtitle={`${kpis.outstandingInvoices.count} invoices`}
          icon={<FileText className="h-5 w-5" />}
          trend={null}
          color="amber"
        />
        <KPICard
          title="Overdue Invoices"
          value={formatCurrency(kpis.overdueInvoices.value)}
          subtitle={`${kpis.overdueInvoices.count} invoices`}
          icon={<AlertTriangle className="h-5 w-5" />}
          trend={kpis.overdueInvoices.count > 0 ? 'down' : null}
          color={kpis.overdueInvoices.count > 0 ? 'red' : 'green'}
        />
        <KPICard
          title="Customers at Risk"
          value={formatNumber(kpis.customersAtRisk)}
          icon={<AlertCircle className="h-5 w-5" />}
          trend={kpis.customersAtRisk > 0 ? 'down' : null}
          color={kpis.customersAtRisk > 0 ? 'red' : 'green'}
        />
        <KPICard
          title="Overdue Tasks"
          value={formatNumber(kpis.overdueTasks)}
          icon={<ClipboardList className="h-5 w-5" />}
          trend={kpis.overdueTasks > 0 ? 'down' : null}
          color={kpis.overdueTasks > 0 ? 'red' : 'green'}
        />
      </section>

      {/* Alerts Section */}
      {(alerts.accountLockouts > 0 || alerts.failedLogins > 0) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold">System Alerts</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {alerts.accountLockouts > 0 && (
              <span>
                <strong>{alerts.accountLockouts}</strong> account lockout{alerts.accountLockouts !== 1 ? 's' : ''}
              </span>
            )}
            {alerts.failedLogins > 0 && (
              <span>
                <strong>{alerts.failedLogins}</strong> failed login attempt{alerts.failedLogins !== 1 ? 's' : ''} (last 24h)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Financial Overview */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <DollarSign className="h-5 w-5 text-green-500" />
              Financial Overview
            </h2>
            <Link to="/invoices" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">MRR</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.mrr)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Staff Aug Value</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.staffAugValue)}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Revenue Trend (Last 12 Months)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Invoice Status</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-border bg-muted p-2">
                <p className="text-xs text-muted-foreground">Draft</p>
                <p className="font-semibold">{financial.invoiceStatus.draft.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(financial.invoiceStatus.draft.value)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted p-2">
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="font-semibold">{financial.invoiceStatus.sent.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(financial.invoiceStatus.sent.value)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted p-2">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-semibold">{financial.invoiceStatus.paid.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(financial.invoiceStatus.paid.value)}</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2">
                <p className="text-xs text-red-700">Overdue</p>
                <p className="font-semibold text-red-900">{financial.invoiceStatus.overdue.count}</p>
                <p className="text-xs text-red-700">{formatCurrency(financial.invoiceStatus.overdue.value)}</p>
              </div>
            </div>
          </div>

          {financial.topCustomers.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Top Customers by Revenue</h3>
              <div className="space-y-1">
                {financial.topCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between rounded-md border border-border bg-muted p-2 text-sm">
                    <span className="font-medium">{customer.name}</span>
                    <span className="font-semibold text-green-600">{formatCurrency(customer.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CRM & Sales Overview */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              CRM & Sales
            </h2>
            <Link to="/crm" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-foreground">{formatPercentage(crm.winRate)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Active Leads</p>
              <p className="text-2xl font-bold text-foreground">
                {Object.values(crm.leadsByStatus).reduce((sum, count) => sum + count, 0)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Customer Status</h3>
            <ResponsiveContainer width="100%" height={150}>
              <RechartsPieChart>
                <Pie
                  data={customerStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {customerStatusData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {crm.atRiskCustomers.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-red-700">Customers at Risk</h3>
              <div className="space-y-1">
                {crm.atRiskCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="rounded-md border border-red-200 bg-red-50 p-2 text-sm">
                    <span className="font-medium text-red-900">{customer.name}</span>
                    <span className="ml-2 text-xs text-red-700">({customer.sentiment})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* HR Overview */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Users className="h-5 w-5 text-purple-500" />
              HR & Employees
            </h2>
            <Link to="/employees" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">EOD Compliance</p>
              <p className="text-2xl font-bold text-foreground">{formatPercentage(hr.eodCompliance.overallRate)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">New Hires (Month)</p>
              <p className="text-2xl font-bold text-foreground">{hr.newHiresThisMonth}</p>
            </div>
          </div>

          {hr.eodCompliance.employeesWithIssues.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-red-700">Employees with EOD Issues</h3>
              <div className="space-y-1">
                {hr.eodCompliance.employeesWithIssues.slice(0, 5).map((employee) => (
                  <div key={employee.id} className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-2 text-sm">
                    <span className="font-medium text-red-900">{employee.name}</span>
                    <span className="font-semibold text-red-700">{employee.lateCount} late</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hr.leaveManagement.pending > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">
                {hr.leaveManagement.pending} pending leave request{hr.leaveManagement.pending !== 1 ? 's' : ''}
              </p>
              <Link to="/employees/leave-requests" className="mt-1 text-xs text-amber-700 hover:underline">
                Review requests →
              </Link>
            </div>
          )}
        </div>

        {/* Recruitment Overview */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Briefcase className="h-5 w-5 text-teal-500" />
              Recruitment
            </h2>
            <Link to="/recruitment" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Hire Rate</p>
              <p className="text-2xl font-bold text-foreground">{formatPercentage(recruitment.hireRate)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Open Positions</p>
              <p className="text-2xl font-bold text-foreground">{recruitment.openPositions.total}</p>
            </div>
          </div>

          {recruitment.topRecruiters.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Top Recruiters (This Month)</h3>
              <div className="space-y-1">
                {recruitment.topRecruiters.slice(0, 5).map((recruiter, index) => (
                  <div key={index} className="flex items-center justify-between rounded-md border border-border bg-muted p-2 text-sm">
                    <span className="font-medium">{recruiter.name}</span>
                    <span className="font-semibold text-green-600">{recruiter.placements} placements</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tasks & Recent Activities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tasks Overview */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ClipboardList className="h-5 w-5 text-indigo-500" />
              Tasks
            </h2>
            <Link to="/tasks" className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Active Tasks</p>
              <p className="text-2xl font-bold text-foreground">{tasks.activeTasks}</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Completed (Week)</p>
              <p className="text-2xl font-bold text-foreground">{tasks.completedThisWeek}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Tasks by Status</h3>
            <ResponsiveContainer width="100%" height={150}>
              <RechartsPieChart>
                <Pie
                  data={tasksByStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tasksByStatusData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Activity className="h-5 w-5 text-orange-500" />
              Recent Activities
            </h2>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentActivities.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">No recent activities</p>
            ) : (
              recentActivities.slice(0, 20).map((activity) => (
                <div key={activity.id} className="rounded-md border border-border bg-muted p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{activity.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.user.name} • {activity.typeName}
                      </p>
                      {activity.entity.name !== 'Unknown' && (
                        <p className="text-xs text-muted-foreground">
                          {activity.entity.type}: {activity.entity.name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), 'MMM dd, HH:mm')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | null;
  color: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}

function KPICard({ title, value, subtitle, icon, trend, color }: KPICardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`rounded-full p-2 ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

