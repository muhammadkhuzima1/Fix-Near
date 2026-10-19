import React from 'react';
import { PriorityLevel } from '../../types';

interface PriorityBadgeProps {
  priority: PriorityLevel;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className = '' }) => {
  switch (priority) {
    case 'emergency':
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-300 uppercase tracking-wider ${className}`}>
          Emergency
        </span>
      );
    case 'high':
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 capitalize ${className}`}>
          High Priority
        </span>
      );
    case 'medium':
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 capitalize ${className}`}>
          Medium
        </span>
      );
    case 'low':
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 capitalize ${className}`}>
          Low
        </span>
      );
    default:
      return <span className="text-xs text-slate-500">{priority}</span>;
  }
};
