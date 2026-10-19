import {
  AIProblemAnalysis,
  AIManagerInsights,
  ServiceRequest,
  User,
  TechnicianProfile,
  ServiceCategory,
  PriorityLevel,
} from '../types';

export class AIService {
  /**
   * 1. Analyze customer problem description in natural language
   * Identifies category, required technician skill, priority, title, technician-friendly summary, and reasoning.
   */
  public static async analyzeProblem(problemDescription: string): Promise<AIProblemAnalysis> {
    const trimmed = (problemDescription || '').trim();
    if (!trimmed) {
      return {
        category: 'general',
        requiredSkill: 'General Diagnostics',
        priority: 'medium',
        title: 'General Service Request',
        technicianSummary: 'Customer submitted a general service request.',
        reasoning: 'Default baseline classification.',
      };
    }

    try {
      const res = await fetch('/api/ai/analyze-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemDescription: trimmed }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          category: data.category as ServiceCategory,
          requiredSkill: data.requiredSkill,
          priority: data.priority as PriorityLevel,
          title: data.title,
          technicianSummary: data.technicianSummary,
          reasoning: data.reasoning,
          confidenceScore: data.confidenceScore,
          source: data.source,
        };
      }
    } catch (err) {
      console.warn('AI analysis API endpoint error, using client-side fallback:', err);
    }

    // Client-side fallback rule classifier if server is unreachable
    return this.clientFallbackClassify(trimmed);
  }

  /**
   * 2. Generate Manager AI Insights using real Supabase metrics
   */
  public static async getManagerInsights(data: {
    requests: ServiceRequest[];
    technicians: User[];
    technicianProfiles: TechnicianProfile[];
  }): Promise<AIManagerInsights> {
    try {
      const res = await fetch('/api/ai/manager-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Manager insights API endpoint error, using client calculation:', err);
    }

    // Client-side fallback calculations from real data
    return this.clientFallbackInsights(data);
  }

  private static clientFallbackClassify(description: string): AIProblemAnalysis {
    const text = description.toLowerCase();
    let category: ServiceCategory = 'general';
    let requiredSkill = 'General Maintenance & Diagnostics';

    const kwMap: Record<ServiceCategory, string[]> = {
      plumbing: ['leak', 'pipe', 'water', 'drain', 'clog', 'faucet', 'toilet', 'sink', 'heater', 'sewage', 'pressure'],
      electrical: ['electric', 'spark', 'outlet', 'breaker', 'fuse', 'power', 'wiring', 'light', 'flicker', 'voltage', 'shock'],
      hvac: ['ac', 'air condition', 'heating', 'heat', 'furnace', 'thermostat', 'condenser', 'filter', 'cold air', 'warm air'],
      appliance: ['refrigerator', 'fridge', 'washer', 'dryer', 'dishwasher', 'oven', 'stove', 'microwave', 'freezer'],
      carpentry: ['door', 'window', 'frame', 'cabinet', 'hinge', 'deck', 'wood', 'lock', 'trim', 'shelf'],
      general: ['repair', 'broken', 'maintenance', 'fix', 'install'],
    };

    let highestScore = 0;
    for (const [cat, kws] of Object.entries(kwMap)) {
      const score = kws.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
      if (score > highestScore) {
        highestScore = score;
        category = cat as ServiceCategory;
      }
    }

    // Skill refinement
    if (category === 'plumbing') {
      requiredSkill = text.includes('water heater') ? 'Water Heater Specialist' : text.includes('drain') || text.includes('clog') ? 'Drain Clearing & Snaking' : 'Pipe Leak Diagnostics & Soldering';
    } else if (category === 'electrical') {
      requiredSkill = text.includes('breaker') || text.includes('panel') ? 'Electrical Panel & Breaker Repair' : 'Branch Circuit Wiring & Outlet Diagnostics';
    } else if (category === 'hvac') {
      requiredSkill = text.includes('heat') || text.includes('furnace') ? 'Furnace Heating Element Diagnostics' : 'AC Compressor & Refrigerant Servicing';
    } else if (category === 'appliance') {
      requiredSkill = text.includes('fridge') || text.includes('freezer') ? 'Refrigeration System & Compressor' : 'Major Home Appliance Diagnostics';
    } else if (category === 'carpentry') {
      requiredSkill = 'Architectural Carpentry & Hardware Fitting';
    }

    // Priority
    let priority: PriorityLevel = 'medium';
    let reasoning = 'Standard non-hazardous issue requiring scheduled technician visit.';

    if (text.includes('flood') || text.includes('gas') || text.includes('smoke') || text.includes('sparking') || text.includes('fire')) {
      priority = 'emergency';
      reasoning = 'Urgent hazard detected (flooding, smoke, or electrical sparking). Auto-dispatch marked Emergency.';
    } else if (text.includes('leak') || text.includes('no heat') || text.includes('no ac') || text.includes('spoiling') || text.includes('urgent')) {
      priority = 'high';
      reasoning = 'Active leak or significant equipment failure detected. High priority dispatch recommended.';
    } else if (text.includes('cosmetic') || text.includes('minor') || text.includes('routine') || text.includes('next week')) {
      priority = 'low';
      reasoning = 'Routine maintenance request with no immediate functional impact.';
    }

    const firstSentence = description.split('. ')[0].split('\n')[0].slice(0, 50);
    const capitalizedCat = category.charAt(0).toUpperCase() + category.slice(1);
    const title = `${capitalizedCat} Service: ${firstSentence}`;
    const technicianSummary = `[${category.toUpperCase()} DISPATCH] Customer reports: "${description.slice(0, 140)}${description.length > 140 ? '...' : ''}". Skill needed: ${requiredSkill}. Priority: ${priority.toUpperCase()}.`;

    return {
      category,
      requiredSkill,
      priority,
      title,
      technicianSummary,
      reasoning,
      confidenceScore: 0.88,
      source: 'client-nlp',
    };
  }

  private static clientFallbackInsights(data: {
    requests: ServiceRequest[];
    technicians: User[];
    technicianProfiles: TechnicianProfile[];
  }): AIManagerInsights {
    const { requests, technicians, technicianProfiles } = data;
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending');
    const available = technicianProfiles.filter((p) => p.status === 'available');

    const counts: Record<string, number> = {};
    requests.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });

    const breakdown = Object.entries(counts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topCategory = breakdown[0]?.category || 'None';

    const summaryText = total === 0
      ? `Operational queue is currently clear with 0 active service orders. ${technicians.length} field technician(s) registered with ${available.length} available for dispatch.`
      : `Currently tracking ${total} total service order(s) with ${technicians.length} field technician(s). ${pending.length} request(s) in pending queue and ${available.length} technician(s) available for auto-dispatch. Highest service demand is in ${topCategory.toUpperCase()}.`;

    return {
      generatedAt: new Date().toISOString(),
      summary: summaryText,
      demandAnalysis: {
        topCategory,
        categoryBreakdown: breakdown,
        demandTrend: total > 0
          ? `Highest demand concentrated in ${topCategory} (${breakdown[0]?.percentage || 0}% of all tickets).`
          : 'No service request data recorded yet.',
      },
      workloadAnalysis: {
        totalTechnicians: technicians.length,
        availableCount: available.length,
        busyCount: Math.max(0, technicians.length - available.length),
        utilizationRate: technicians.length > 0 ? Math.round(((technicians.length - available.length) / technicians.length) * 100) : 0,
        overloadedTechnicians: [],
        capacityStatus: available.length === 0 && pending.length > 0 ? 'critical' : 'optimal',
      },
      pendingQueueAnalysis: {
        pendingCount: pending.length,
        criticalPendingCount: pending.filter((r) => r.priority === 'emergency' || r.priority === 'high').length,
        bottleneckSpecialty: pending[0]?.category || 'None',
        autoDispatchFeasible: available.length > 0 && pending.length > 0,
      },
      recommendations: [
        {
          type: 'dispatch',
          title: 'AI Auto-Dispatch Optimization',
          description: `Active AI matching continuously pairs incoming requests with certified available technicians.`,
          priority: 'high',
        },
        {
          type: 'operations',
          title: total > 0 ? `Resource Allocation for ${topCategory.toUpperCase()}` : 'Resource Monitoring',
          description: total > 0
            ? `Maintain parts and technician availability for ${topCategory} which represents highest operational volume.`
            : 'Operational resources and technician status monitored in real-time.',
          priority: 'medium',
        },
      ],
    };
  }
}
