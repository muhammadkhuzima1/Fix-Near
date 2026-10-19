import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="w-full divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg overflow-hidden animate-pulse">
      <div className="h-10 bg-slate-50 px-4 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
        <div className="h-4 bg-slate-200 rounded w-20"></div>
        <div className="h-4 bg-slate-200 rounded w-32 hidden sm:block"></div>
        <div className="h-4 bg-slate-200 rounded w-16"></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0"></div>
            <div className="space-y-1.5">
              <div className="h-3.5 bg-slate-200 rounded w-32"></div>
              <div className="h-2.5 bg-slate-100 rounded w-20"></div>
            </div>
          </div>
          <div className="h-4 bg-slate-100 rounded w-20"></div>
          <div className="h-4 bg-slate-100 rounded w-28 hidden sm:block"></div>
          <div className="h-7 bg-slate-100 rounded w-16"></div>
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 rounded w-24"></div>
            <div className="h-4 bg-slate-100 rounded w-16"></div>
          </div>
          <div className="h-5 bg-slate-200 rounded w-4/5"></div>
          <div className="h-3.5 bg-slate-100 rounded w-full"></div>
          <div className="h-3.5 bg-slate-100 rounded w-2/3"></div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3 bg-slate-100 rounded w-20"></div>
            <div className="h-7 bg-slate-200 rounded w-20"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
