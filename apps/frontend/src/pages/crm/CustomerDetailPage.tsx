import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/crm';
import type {
  CustomerActivity,
  CustomerOpportunity,
} from '@/types/crm';
import {
  ArrowLeft,
  Building,
  Calendar,
  DollarSign,
  FileBarChart2,
  Edit3,
  Globe,
  Mail,
  MapPin,
  MinusCircle,
  Phone,
  RefreshCw,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';
import { CustomerForm } from '@/components/crm/customers/CustomerForm';
import { CustomerStatusForm } from '@/components/crm/customers/CustomerStatusForm';
import { format } from 'date-fns';
import clsx from 'clsx';

const sentimentClass = {
  HAPPY: 'bg-green-100 text-green-700',
  NEUTRAL: 'bg-gray-100 text-gray-700',
  UNHAPPY: 'bg-red-100 text-red-700',
};

const statusClass = {
  ONBOARDING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  AT_RISK: 'bg-orange-100 text-orange-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  CHURNED: 'bg-red-100 text-red-700',
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getById(id!),
    enabled: Boolean(id),
  });

  const activitiesQuery = useQuery({
    queryKey: ['customer-activities', id],
    queryFn: () => customersApi.getActivities(id!, 25),
    enabled: Boolean(id),
  });

  const opportunitiesQuery = useQuery({
    queryKey: ['customer-opportunities', id],
    queryFn: () => customersApi.getOpportunities(id!),
    enabled: Boolean(id),
  });

  const customer = customerQuery.data;

  const lastUpdated = useMemo(() => {
    if (!customer) return null;
    return format(new Date(customer.updatedAt), 'MMM dd, yyyy');
  }, [customer]);

  if (!id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Invalid customer ID provided.
        </div>
      </div>
    );
  }

  if (customerQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (customerQuery.isError || !customer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load customer. It may have been removed or you do not have access.
        </div>
        <button
          onClick={() => navigate('/crm/customers')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </button>
      </div>
    );
  }

  const renderOpportunityValue = (opportunity: CustomerOpportunity) => {
    if (opportunity.value === null || opportunity.value === undefined) return '—';
    return `${opportunity.type === 'STAFF_AUGMENTATION' ? 'Aug' : 'Sub'} ${opportunity.value.toLocaleString()}`;
  };

  const renderActivityIcon = (activity: CustomerActivity) => {
    switch (activity.type) {
      case 'CALL':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'EMAIL':
        return <Mail className="h-4 w-4 text-purple-500" />;
      case 'MEETING':
        return <Calendar className="h-4 w-4 text-emerald-500" />;
      case 'TASK_UPDATE':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      case 'STATUS_CHANGE':
        return <RefreshCw className="h-4 w-4 text-indigo-500" />;
      default:
        return <MinusCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <button
        onClick={() => navigate('/crm/customers')}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </button>

      <header className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
              {customer.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>{customer.email}</span>
                {customer.website && (
                  <>
                    <span>•</span>
                    <a
                      className="text-blue-600 hover:underline"
                      href={customer.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {customer.website}
                    </a>
                  </>
                )}
                {customer.industry && (
                  <>
                    <span>•</span>
                    <span>{customer.industry}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Customer Type:</span>
            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
              {customer.type.replace('_', ' ')}
            </span>
            <span>Last Updated:</span>
            <span className="font-medium text-gray-700">{lastUpdated}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
              statusClass[customer.status],
            )}
          >
            Status: {customer.status.replace('_', ' ')}
          </span>
          <span
            className={clsx(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
              sentimentClass[customer.sentiment],
            )}
          >
            Sentiment: {customer.sentiment}
          </span>
          <button
            onClick={() => setShowStatusForm(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Sparkles className="h-4 w-4" />
            Update Health
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
        </div>
      </header>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}{' '}
          <button
            className="text-xs font-semibold uppercase tracking-wide text-emerald-800"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-500">
            <span>Monthly Value</span>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {customer.monthlyValue !== null && customer.monthlyValue !== undefined
              ? `${customer.currency ?? 'USD'} ${customer.monthlyValue.toLocaleString()}`
              : '—'}
          </p>
          <p className="text-xs text-gray-500">Contracted monthly revenue</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-500">
            <span>Contacts</span>
            <Users className="h-4 w-4 text-green-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {customer._count?.contacts ?? 0}
          </p>
          <p className="text-xs text-gray-500">Active stakeholder contacts</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-500">
            <span>Opportunities</span>
            <Building className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {customer._count?.opportunities ?? 0}
          </p>
          <p className="text-xs text-gray-500">Active commercial engagements</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-500">
            <span>Invoices</span>
            <FileBarChart2 className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {customer._count?.invoices ?? 0}
          </p>
          <p className="text-xs text-gray-500">Generated billing documents</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Account Overview</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Email</p>
                  <p className="text-sm text-gray-800">{customer.email}</p>
                </div>
              </div>
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Phone</p>
                    <p className="text-sm text-gray-800">{customer.phone}</p>
                  </div>
                </div>
              )}
              {customer.website && (
                <div className="flex items-start gap-3">
                  <Globe className="mt-1 h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Website</p>
                    <a
                      className="text-sm text-blue-600 hover:underline"
                      href={customer.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {customer.website}
                    </a>
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Location</p>
                    <p className="text-sm text-gray-800">
                      {customer.address}
                      {customer.city && `, ${customer.city}`}
                      {customer.country && `, ${customer.country}`}
                      {customer.postalCode && ` ${customer.postalCode}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {customer.contacts && customer.contacts.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase text-gray-500">Key Contacts</p>
                <div className="mt-3 space-y-3">
                  {customer.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </span>
                        {contact.role && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {contact.role}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>{contact.email}</span>
                        {contact.phone && (
                          <>
                            <span>•</span>
                            <span>{contact.phone}</span>
                          </>
                        )}
                        {contact.companyName && !customer.name.includes(contact.companyName) && (
                          <>
                            <span>•</span>
                            <span>{contact.companyName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {customer.tags && customer.tags.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase text-gray-500">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                {customer.notes}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Opportunities</h2>
              <Link
                to="/crm/opportunities"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Go to Pipeline
              </Link>
            </div>
            {opportunitiesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : opportunitiesQuery.data && opportunitiesQuery.data.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Title</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Stage</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Value</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {opportunitiesQuery.data.slice(0, 5).map((opportunity) => (
                      <tr key={opportunity.id}>
                        <td className="px-4 py-3 text-gray-800">{opportunity.title}</td>
                        <td className="px-4 py-3 text-gray-500">{opportunity.stage}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {renderOpportunityValue(opportunity)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {opportunity.assignedTo
                            ? `${opportunity.assignedTo.firstName} ${opportunity.assignedTo.lastName}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
                No opportunities yet.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
              <button
                onClick={() => activitiesQuery.refetch()}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {activitiesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : activitiesQuery.data && activitiesQuery.data.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {activitiesQuery.data.map((activity) => (
                  <li key={activity.id} className="flex gap-3 rounded-lg border border-gray-200 p-3">
                    <div className="mt-1">{renderActivityIcon(activity)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-900">{activity.title}</span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="mt-1 text-sm text-gray-600">{activity.description}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        Logged by {activity.createdBy.firstName} {activity.createdBy.lastName}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                No activities recorded yet.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Invoices Snapshot</h2>
            {customer.invoices && customer.invoices.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                {customer.invoices.map((invoice) => (
                  <li key={invoice.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="text-xs text-gray-500">
                        Due {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Status: {invoice.status}</span>
                      <span>
                        Total:{' '}
                        {invoice.total !== null && invoice.total !== undefined
                          ? `${customer.currency ?? 'USD'} ${invoice.total.toLocaleString()}`
                          : '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                No invoices generated yet.
              </div>
            )}
          </div>
        </aside>
      </section>

      {showEdit && (
        <CustomerForm
          customer={customer}
          onClose={() => setShowEdit(false)}
          onSuccess={(updated) => {
            queryClient.invalidateQueries({ queryKey: ['customer', id] });
            setFeedback(`Customer ${updated.name} updated successfully.`);
            setShowEdit(false);
          }}
        />
      )}

      {showStatusForm && (
        <CustomerStatusForm
          customer={customer}
          onClose={() => setShowStatusForm(false)}
          onSuccess={(updated) => {
            queryClient.invalidateQueries({ queryKey: ['customer', id] });
            setFeedback(`Customer ${updated.name} health updated.`);
            setShowStatusForm(false);
          }}
        />
      )}
    </div>
  );
}

