import type { InvoiceStatus } from '@/types/invoices';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
  SENT: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200',
  PAID: 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-200',
  OVERDUE: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const label = status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {label}
    </span>
  );
}


