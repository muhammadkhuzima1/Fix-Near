import React from 'react';
import { PriorityLevel } from '../../types';

interface PriorityBadgeProps {
  priority: PriorityLevel;
  size?: 'sm' | 'md';
  className?: string;
}

export function isUrgentPriority(priority?: PriorityLevel): boolean {
  return priority === 'emergency' || priority === 'high';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className = '' }) => {
  switch (priority) {
    case 'emergency':
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-300 uppercase tracking-wider ${className}`}
        >
          <span>Urgent · Emergency</span>
        </span>
      );
    case 'high':
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 ${className}`}
        >
          <span>Urgent</span>
        </span>
      );
    case 'medium':
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 ${className}`}
        >
          <span>Normal</span>
        </span>
      );
    case 'low':
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 ${className}`}
        >
          <span>Normal · Low</span>
        </span>
      );
    default:
      return <span className="text-xs text-slate-500">Normal</span>;
  }
};

