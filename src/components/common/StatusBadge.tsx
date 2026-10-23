import React from 'react';
import { ServiceStatus } from '../../types';

interface StatusBadgeProps {
  status: ServiceStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  // Respecting frontend-design zero-pill discipline: unboxed clean text with typographic dot and subtle background tone
  switch (status) {
    case 'pending':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded border border-amber-200/70 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Pending Approval
        </span>
      );
    case 'approved':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50/80 px-2.5 py-1 rounded border border-sky-200/70 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" aria-hidden="true" />
          Approved (Ready)
        </span>
      );
    case 'assigned':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded border border-indigo-200/70 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
          Tech Assigned
        </span>
      );
    case 'accepted':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50/80 px-2.5 py-1 rounded border border-violet-200/70 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" aria-hidden="true" />
          Job Accepted
        </span>
      );
    case 'in_progress':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50/90 px-2.5 py-1 rounded border border-emerald-300/80 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          In Progress
        </span>
      );
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-300/80 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700" aria-hidden="true" />
          Completed
        </span>
      );
    case 'cancelled':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50/80 px-2.5 py-1 rounded border border-rose-200/70 whitespace-nowrap ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" aria-hidden="true" />
          Cancelled
        </span>
      );
    default:
      return <span className="text-xs text-slate-500">{status}</span>;
  }
};
