import React, { useState, useEffect } from 'react';
import { ServiceRequestLog } from '../../types';
import { store } from '../../services/store';
import { SupabaseService } from '../../services/supabaseService';
import { EmptyState } from '../common/EmptyState';
import { History, Search, ShieldCheck, Wrench, User } from 'lucide-react';

export const ManagerAuditLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<ServiceRequestLog[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadLogs = async () => {
      try {
        const data = await SupabaseService.fetchLogs();
        if (isMounted) setLogs(data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      }
    };
    loadLogs();
    const unsub = store.subscribe(() => {
      loadLogs();
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.note.toLowerCase().includes(search.toLowerCase()) ||
      l.changedByName.toLowerCase().includes(search.toLowerCase()) ||
      l.fromStatus.toLowerCase().includes(search.toLowerCase()) ||
      l.toStatus.toLowerCase().includes(search.toLowerCase()) ||
      l.requestId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 truncate">
            System Operations Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            Immutable log of state transitions, dispatches, and resolutions
          </p>
        </div>

        <div className="relative w-full sm:w-72 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white min-w-0"
          />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Audit log is currently empty"
          description="Every lifecycle event (submission, approval, assignment, work start, completion, cancellation) is automatically logged here."
        />
      ) : (
        <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {filteredLogs.map((l) => (
            <div
              key={l.id}
              className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase shrink-0">
                    {l.fromStatus} → {l.toStatus}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 min-w-0 truncate">
                    {l.changedByRole === 'manager' && <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    {l.changedByRole === 'technician' && <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    {l.changedByRole === 'customer' && <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    <span className="font-medium text-slate-700 truncate">{l.changedByName}</span>
                    <span className="text-slate-400 shrink-0">({l.changedByRole})</span>
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-slate-900 font-medium break-words leading-relaxed">{l.note}</div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  Ticket Ref: {l.requestId}
                </div>
              </div>

              <div className="text-left sm:text-right text-xs font-mono text-slate-400 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div>{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-[11px]">{new Date(l.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
