import React, { useState, useEffect } from 'react';
import { ServiceRequest, User, TechnicianProfile, AIManagerInsights } from '../../types';
import { AIService } from '../../services/aiService';
import { SupabaseService } from '../../services/supabaseService';
import { useToast } from '../../context/ToastContext';
import {
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  ShieldCheck,
  Briefcase,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ManagerAIInsightsProps {
  requests: ServiceRequest[];
  technicians: User[];
  technicianProfiles: TechnicianProfile[];
  onRefreshData?: () => void;
}

export const ManagerAIInsights: React.FC<ManagerAIInsightsProps> = ({
  requests,
  technicians,
  technicianProfiles,
  onRefreshData,
}) => {
  const { showToast } = useToast();
  const [insights, setInsights] = useState<AIManagerInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const data = await AIService.getManagerInsights({
        requests,
        technicians,
        technicianProfiles,
      });
      setInsights(data);
    } catch (err) {
      console.error('Failed to generate insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [requests.length, technicians.length, technicianProfiles.length]);

  const handleRunAutoDispatch = async () => {
    setDispatching(true);
    try {
      const results = await SupabaseService.autoAssignPendingRequests();
      if (results.length > 0) {
        showToast(`AI Auto-Dispatch Engine assigned ${results.length} pending ticket(s)!`, 'success');
        if (onRefreshData) onRefreshData();
        fetchInsights();
      } else {
        const pendingCount = requests.filter((r) => r.status === 'pending').length;
        if (pendingCount === 0) {
          showToast('No pending tickets in queue. All work orders are active or completed!', 'info');
        } else {
          showToast(
            `Checked queue: No available technicians with matching skills currently open for ${pendingCount} pending ticket(s).`,
            'info'
          );
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Auto-dispatch check failed.', 'error');
    } finally {
      setDispatching(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const availableCount = technicianProfiles.filter((p) => p.status === 'available').length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI Operational Intelligence</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            Manager Executive Insights & Autonomous Dispatch
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRunAutoDispatch}
            disabled={dispatching}
            className="px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${dispatching ? 'animate-bounce' : ''}`} />
            <span>{dispatching ? 'Scanning...' : 'Run Auto-Dispatch Queue'}</span>
          </button>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Refresh AI Insights"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Executive Summary Card */}
      {insights && (
        <div className="p-4 sm:p-5 bg-linear-to-r from-slate-900 to-indigo-950 text-white rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider font-semibold">
              Executive Dispatch Overview
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Updated {new Date(insights.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
            {insights.summary}
          </p>
        </div>
      )}

      {/* 4 Diagnostics Panels */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Demand Analytics */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                <span>Service Demand</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Peak: {insights.demandAnalysis.topCategory}
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              {insights.demandAnalysis.categoryBreakdown.slice(0, 3).map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="capitalize truncate font-medium">{item.category}</span>
                    <span className="font-mono text-slate-500">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-1 leading-normal">
              {insights.demandAnalysis.demandTrend}
            </p>
          </div>

          {/* 2. Technician Workload */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Tech Utilization</span>
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  insights.workloadAnalysis.capacityStatus === 'critical'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {insights.workloadAnalysis.capacityStatus}
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {insights.workloadAnalysis.utilizationRate}%
              </span>
              <span className="text-[11px] text-slate-500">Utilization Rate</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>Available for Dispatch:</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  {insights.workloadAnalysis.availableCount} tech(s)
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Active On-Job:</span>
                <span className="font-semibold text-slate-700 font-mono">
                  {insights.workloadAnalysis.busyCount} tech(s)
                </span>
              </div>
            </div>
          </div>

          {/* 3. Pending Queue & Auto-Dispatch */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pending Queue</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Bottleneck: {insights.pendingQueueAnalysis.bottleneckSpecialty}
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {insights.pendingQueueAnalysis.pendingCount}
              </span>
              <span className="text-[11px] text-slate-500">Pending tickets</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>Critical / High:</span>
                <span className="font-semibold text-rose-600 font-mono">
                  {insights.pendingQueueAnalysis.criticalPendingCount}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Auto-Dispatch Status:</span>
                <span className="font-medium text-indigo-700">
                  {insights.pendingQueueAnalysis.autoDispatchFeasible ? 'Ready to Pair' : 'Waiting for Techs'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Automated Efficiency */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <span>Autonomous Engine</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                Active
              </span>
            </div>
            <div className="pt-1">
              <p className="text-xs text-slate-700 leading-relaxed">
                Manager manual assignment is not required. Incoming requests are automatically matched to certified technicians by skills and capacity.
              </p>
            </div>
            <div className="text-[11px] text-indigo-600 font-semibold pt-1 flex items-center gap-1">
              <span>Auto-Assign on tech availability: Enabled</span>
            </div>
          </div>
        </div>
      )}

      {/* Strategic AI Recommendations */}
      {insights && insights.recommendations.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            AI Operations Recommendations
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {insights.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3 sm:p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-900 truncate">
                    {rec.title}
                  </h4>
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      rec.priority === 'high'
                        ? 'bg-rose-100 text-rose-700'
                        : rec.priority === 'medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
