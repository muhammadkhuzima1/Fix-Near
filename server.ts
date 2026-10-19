import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini API client if API key is provided
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Helper: Smart Rule-Based NLP Fallback Classifier
function analyzeProblemWithRules(description: string) {
  const text = (description || '').toLowerCase();

  // Category determination
  let category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'carpentry' | 'general' = 'general';
  let requiredSkill = 'General Maintenance & Diagnostics';

  const plumbingKeywords = [
    'leak', 'pipe', 'water', 'drain', 'clog', 'faucet', 'toilet', 'sink',
    'sewage', 'shower', 'bathtub', 'pressure', 'heater', 'boiler', 'plumb', 'spigot', 'valve'
  ];
  const electricalKeywords = [
    'electric', 'spark', 'outlet', 'breaker', 'fuse', 'power', 'short',
    'switch', 'wiring', 'light', 'flicker', 'voltage', 'circuit', 'shock', 'surge', 'panel'
  ];
  const hvacKeywords = [
    'ac', 'air condition', 'heating', 'heat', 'furnace', 'thermostat',
    'duct', 'blower', 'condenser', 'filter', 'warm air', 'cold air', 'ventilation', 'chiller'
  ];
  const applianceKeywords = [
    'refrigerator', 'fridge', 'washer', 'dryer', 'dishwasher', 'oven',
    'stove', 'microwave', 'freezer', 'cooktop', 'ice maker', 'garbage disposal'
  ];
  const carpentryKeywords = [
    'door', 'window', 'frame', 'wood', 'cabinet', 'hinge', 'deck',
    'floor', 'trim', 'lock', 'molding', 'drywall', 'shelf', 'stair', 'latch'
  ];

  const scoreCategory = (keywords: string[]) =>
    keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);

  const scores = {
    plumbing: scoreCategory(plumbingKeywords),
    electrical: scoreCategory(electricalKeywords),
    hvac: scoreCategory(hvacKeywords),
    appliance: scoreCategory(applianceKeywords),
    carpentry: scoreCategory(carpentryKeywords),
  };

  let maxCategory: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'carpentry' | 'general' = 'general';
  let maxScore = 0;

  for (const [cat, s] of Object.entries(scores)) {
    if (s > maxScore) {
      maxScore = s;
      maxCategory = cat as any;
    }
  }

  if (maxScore > 0) {
    category = maxCategory;
  }

  // Refine required skill based on matched category
  switch (category) {
    case 'plumbing':
      if (text.includes('water heater') || text.includes('boiler')) {
        requiredSkill = 'Water Heater Diagnostics & Replacement';
      } else if (text.includes('clog') || text.includes('drain')) {
        requiredSkill = 'Drain Clearing & Hydro-Jetting';
      } else if (text.includes('leak') || text.includes('pipe')) {
        requiredSkill = 'Pipe Repair & Soldering';
      } else if (text.includes('toilet')) {
        requiredSkill = 'Toilet Mechanism & Flange Repair';
      } else {
        requiredSkill = 'Plumbing Fixture Installation & Repair';
      }
      break;
    case 'electrical':
      if (text.includes('spark') || text.includes('breaker') || text.includes('panel')) {
        requiredSkill = 'Electrical Panel & Circuit Breaker Diagnostics';
      } else if (text.includes('outlet') || text.includes('switch')) {
        requiredSkill = 'Receptacle & Branch Wiring Repair';
      } else {
        requiredSkill = 'Electrical System Troubleshooting & Testing';
      }
      break;
    case 'hvac':
      if (text.includes('warm') || text.includes('cooling') || text.includes('freon') || text.includes('condenser')) {
        requiredSkill = 'Refrigerant & AC Condenser Diagnostics';
      } else if (text.includes('furnace') || text.includes('heat') || text.includes('burner')) {
        requiredSkill = 'Furnace Heating Element & Ignition Repair';
      } else {
        requiredSkill = 'HVAC Thermostat & Air Handler Service';
      }
      break;
    case 'appliance':
      if (text.includes('fridge') || text.includes('refrigerator') || text.includes('freezer')) {
        requiredSkill = 'Refrigeration Compressor & Seal Repair';
      } else if (text.includes('washer') || text.includes('dryer')) {
        requiredSkill = 'Laundry Appliance Motor & Belt Repair';
      } else {
        requiredSkill = 'Major Kitchen Appliance Diagnostics';
      }
      break;
    case 'carpentry':
      if (text.includes('door') || text.includes('lock') || text.includes('latch')) {
        requiredSkill = 'Door Alignment & Hardware Fitting';
      } else if (text.includes('cabinet') || text.includes('shelf')) {
        requiredSkill = 'Cabinetry & Custom Wood Finishing';
      } else {
        requiredSkill = 'Structural Framing & Trim Carpentry';
      }
      break;
    default:
      requiredSkill = 'General Property Maintenance & Repair';
      break;
  }

  // Priority determination
  let priority: 'low' | 'medium' | 'high' | 'emergency' = 'medium';
  let reasoning = 'Standard maintenance ticket evaluated by problem description.';

  const emergencyKeywords = ['flood', 'burst pipe', 'gas', 'smoke', 'fire', 'sparks flying', 'burning smell', 'electrical fire', 'collapsed', 'danger'];
  const highKeywords = ['leak', 'overflow', 'no heat', 'freezing', 'no ac', 'spoiling', 'food', 'tripping', 'hazard', 'urgent', 'asap', 'broken lock'];
  const lowKeywords = ['routine', 'minor', 'squeak', 'paint', 'aesthetic', 'loose', 'cosmetic', 'when possible', 'next week'];

  if (emergencyKeywords.some((k) => text.includes(k))) {
    priority = 'emergency';
    reasoning = 'Urgent hazard detected (active flooding, electrical danger, or property safety risk). Immediate technician dispatch required.';
  } else if (highKeywords.some((k) => text.includes(k))) {
    priority = 'high';
    reasoning = 'Significant functional disruption or potential escalation detected (active leak, temperature failure, or power disruption).';
  } else if (lowKeywords.some((k) => text.includes(k))) {
    priority = 'low';
    reasoning = 'Non-critical cosmetic or routine maintenance request with no immediate risk of property damage.';
  } else {
    priority = 'medium';
    reasoning = 'Standard service request requiring standard dispatch during normal operational hours.';
  }

  // Generate crisp technician-friendly summary
  const summaryPrefix = `[${category.toUpperCase()} DIAGNOSTIC]`;
  const technicianSummary = `${summaryPrefix} Customer reports: "${description.trim().slice(0, 150)}${description.length > 150 ? '...' : ''}". Primary skill required: ${requiredSkill}. Suggested equipment: Standard ${category} toolset, safety tester, replacement fittings/parts. Priority: ${priority.toUpperCase()}.`;

  // Generate title
  const cleanFirstWords = description.trim().split('. ')[0].split('\n')[0].slice(0, 60);
  const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
  const title = `${capitalizedCategory} Issue: ${cleanFirstWords}`;

  return {
    category,
    requiredSkill,
    priority,
    title,
    technicianSummary,
    reasoning,
    confidenceScore: 0.92,
  };
}

// 1. API: Analyze Customer Problem Description
app.post('/api/ai/analyze-problem', async (req, res) => {
  const { problemDescription } = req.body;

  if (!problemDescription || typeof problemDescription !== 'string') {
    return res.status(400).json({ error: 'problemDescription string is required.' });
  }

  // If Gemini API is available, use it for deep natural language understanding
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze the following customer field service problem description:
"${problemDescription}"

Tasks:
1. Identify the single best service category from: ["plumbing", "electrical", "hvac", "appliance", "carpentry", "general"].
2. Identify the specific required technician skill (e.g., "Pipe Repair & Soldering", "Electrical Panel Diagnostics", "Refrigerant & AC Diagnostics", "Appliance Motor Repair", "Custom Cabinetry & Door Fitting", "General Maintenance").
3. Determine priority level from: ["low", "medium", "high", "emergency"]. (Use emergency for active flooding, electrical fires/sparks, gas, or immediate structural danger. Use high for active leaks, lack of heat/cooling in severe weather, or major power outage).
4. Generate a concise, professional title (under 50 characters).
5. Generate a short technician-friendly summary (2-3 sentences explaining the likely issue, root cause hypothesis, and suggested tools/parts).
6. Provide a brief explanation/reasoning of why this category and priority were selected.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'Service category (plumbing, electrical, hvac, appliance, carpentry, or general)',
              },
              requiredSkill: {
                type: Type.STRING,
                description: 'Specific required technician skill',
              },
              priority: {
                type: Type.STRING,
                description: 'Priority level (low, medium, high, emergency)',
              },
              title: {
                type: Type.STRING,
                description: 'Clean concise title for the work order ticket',
              },
              technicianSummary: {
                type: Type.STRING,
                description: 'Concise technician-friendly summary of the problem and suspected equipment',
              },
              reasoning: {
                type: Type.STRING,
                description: 'Reasoning behind the categorization and priority assessment',
              },
            },
            required: ['category', 'requiredSkill', 'priority', 'title', 'technicianSummary', 'reasoning'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const validCategories = ['plumbing', 'electrical', 'hvac', 'appliance', 'carpentry', 'general'];
      const validPriorities = ['low', 'medium', 'high', 'emergency'];

      const category = validCategories.includes(parsed.category?.toLowerCase())
        ? parsed.category.toLowerCase()
        : 'general';
      const priority = validPriorities.includes(parsed.priority?.toLowerCase())
        ? parsed.priority.toLowerCase()
        : 'medium';

      return res.json({
        category,
        requiredSkill: parsed.requiredSkill || 'General Maintenance',
        priority,
        title: parsed.title || `${category.toUpperCase()} Service Request`,
        technicianSummary: parsed.technicianSummary,
        reasoning: parsed.reasoning || 'Classified using Gemini AI natural language understanding.',
        source: 'gemini-3.8-flash',
      });
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to rule-based NLP:', err.message);
      const fallbackResult = analyzeProblemWithRules(problemDescription);
      return res.json({ ...fallbackResult, source: 'rule-based-nlp-fallback' });
    }
  }

  // Fallback to fast smart rule-based classifier if GEMINI_API_KEY is not configured
  const fallbackResult = analyzeProblemWithRules(problemDescription);
  return res.json({ ...fallbackResult, source: 'rule-based-nlp' });
});

// 2. API: Manager AI Insights
app.post('/api/ai/manager-insights', async (req, res) => {
  const { requests = [], technicians = [], technicianProfiles = [] } = req.body;

  // Compute real mathematical operational metrics from Supabase data
  const totalRequests = requests.length;
  const pendingRequests = requests.filter((r: any) => r.status === 'pending');
  const approvedRequests = requests.filter((r: any) => r.status === 'approved');
  const activeRequests = requests.filter((r: any) =>
    ['assigned', 'accepted', 'in_progress'].includes(r.status)
  );
  const completedRequests = requests.filter((r: any) => r.status === 'completed');
  const cancelledRequests = requests.filter((r: any) => r.status === 'cancelled');

  // Category counts
  const categoryCounts: Record<string, number> = {};
  requests.forEach((r: any) => {
    const c = r.category || 'general';
    categoryCounts[c] = (categoryCounts[c] || 0) + 1;
  });

  const categoryBreakdown = Object.entries(categoryCounts)
    .map(([cat, count]) => ({
      category: cat,
      count,
      percentage: totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topCategory = categoryBreakdown[0]?.category || 'General';

  // Technician availability & workload
  const availableTechs = technicianProfiles.filter((p: any) => p.status === 'available');
  const onJobTechs = technicianProfiles.filter((p: any) => p.status === 'on_job');
  const offDutyTechs = technicianProfiles.filter((p: any) => p.status === 'off_duty');

  // Workload per technician
  const techWorkloads = technicians.map((tech: any) => {
    const prof = technicianProfiles.find((p: any) => p.id === tech.id || p.userId === tech.id);
    const activeJobs = activeRequests.filter((r: any) => r.assignedTechnicianId === tech.id).length;
    return {
      techId: tech.id,
      name: tech.fullName,
      specialty: prof?.specialty || 'General',
      status: prof?.status || 'available',
      activeJobs,
      completedJobs: prof?.completedJobsCount || 0,
      rating: prof?.rating || 5.0,
    };
  });

  const overloadedTechs = techWorkloads
    .filter((t: any) => t.activeJobs >= 3)
    .map((t: any) => `${t.name} (${t.activeJobs} active jobs)`);

  const utilizationRate =
    technicians.length > 0
      ? Math.round(((technicians.length - availableTechs.length) / technicians.length) * 100)
      : 0;

  // Pending queue analysis
  const emergencyPending = pendingRequests.filter((r: any) => r.priority === 'emergency').length;
  const highPending = pendingRequests.filter((r: any) => r.priority === 'high').length;

  // Identify bottleneck specialties
  const pendingByCat: Record<string, number> = {};
  pendingRequests.forEach((r: any) => {
    pendingByCat[r.category] = (pendingByCat[r.category] || 0) + 1;
  });
  const bottleneckSpecialty = Object.entries(pendingByCat).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

  // Deterministic summary and recommendations
  const fallbackInsights = {
    generatedAt: new Date().toISOString(),
    summary: `Operations are currently managing ${totalRequests} total work orders across ${technicians.length} field technicians. ${pendingRequests.length} tickets remain in pending status with ${availableTechs.length} available technicians ready for auto-dispatch. Peak demand is currently focused in ${topCategory.toUpperCase()}.`,
    demandAnalysis: {
      topCategory,
      categoryBreakdown,
      demandTrend:
        totalRequests > 10
          ? `High sustained volume in ${topCategory} (${categoryBreakdown[0]?.percentage}% of all tickets).`
          : 'Normal baseline distribution across standard service domains.',
    },
    workloadAnalysis: {
      totalTechnicians: technicians.length,
      availableCount: availableTechs.length,
      busyCount: onJobTechs.length + offDutyTechs.length,
      utilizationRate,
      overloadedTechnicians: overloadedTechs,
      capacityStatus:
        availableTechs.length === 0 && pendingRequests.length > 0
          ? 'critical'
          : utilizationRate > 75
          ? 'moderate'
          : 'optimal',
    },
    pendingQueueAnalysis: {
      pendingCount: pendingRequests.length,
      criticalPendingCount: emergencyPending + highPending,
      bottleneckSpecialty,
      autoDispatchFeasible: availableTechs.length > 0 && pendingRequests.length > 0,
    },
    recommendations: [
      ...(pendingRequests.length > 0 && availableTechs.length > 0
        ? [
            {
              type: 'dispatch' as const,
              title: 'Auto-Dispatch Pending Work Orders',
              description: `There are ${pendingRequests.length} pending requests and ${availableTechs.length} available technicians. Run auto-dispatch to immediately assign matching tickets.`,
              priority: 'high' as const,
            },
          ]
        : []),
      ...(pendingRequests.length > 0 && availableTechs.length === 0
        ? [
            {
              type: 'staffing' as const,
              title: `Technician Capacity Bottleneck in ${bottleneckSpecialty.toUpperCase()}`,
              description: `All technicians with ${bottleneckSpecialty} skills are currently occupied or off-duty. Consider onboarding additional certified ${bottleneckSpecialty} technicians.`,
              priority: 'high' as const,
            },
          ]
        : []),
      {
        type: 'operations' as const,
        title: `Service Demand Concentration: ${topCategory.toUpperCase()}`,
        description: `${topCategory.toUpperCase()} accounts for ${categoryBreakdown[0]?.percentage || 0}% of all customer service requests. Ensure tool and part inventory covers this category.`,
        priority: 'medium' as const,
      },
      {
        type: 'quality' as const,
        title: 'Dispatch Quality & Customer Satisfaction',
        description: `${completedRequests.length} work orders have been successfully resolved. System auto-dispatch is actively balancing technician workloads to maintain service quality.`,
        priority: 'low' as const,
      },
    ],
  };

  // If Gemini API is active, enhance with generative executive synthesis
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are the FixNear Chief Operations Officer AI. Analyze this real field operations dataset from Supabase:
- Total Requests: ${totalRequests}
- Status Breakdown: Pending: ${pendingRequests.length}, Approved: ${approvedRequests.length}, Active: ${activeRequests.length}, Completed: ${completedRequests.length}, Cancelled: ${cancelledRequests.length}
- Top Category: ${topCategory} (${JSON.stringify(categoryBreakdown)})
- Total Technicians: ${technicians.length} (Available: ${availableTechs.length}, On Job: ${onJobTechs.length}, Off Duty: ${offDutyTechs.length})
- Overloaded Technicians: ${overloadedTechs.join(', ') || 'None'}
- Pending Critical Tickets (High/Emergency): ${emergencyPending + highPending}
- Primary Bottleneck Category: ${bottleneckSpecialty}

Provide an executive strategic operations summary (3-4 sentences) and 3 specific, actionable operations recommendations. Output strictly JSON.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    priority: { type: Type.STRING },
                  },
                  required: ['type', 'title', 'description', 'priority'],
                },
              },
            },
            required: ['executiveSummary', 'recommendations'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.executiveSummary) {
        fallbackInsights.summary = parsed.executiveSummary;
      }
      if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        fallbackInsights.recommendations = parsed.recommendations.map((r: any) => ({
          type: ['staffing', 'dispatch', 'operations', 'quality'].includes(r.type) ? r.type : 'operations',
          title: r.title || 'Operational Advisory',
          description: r.description || '',
          priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
        }));
      }
    } catch (e: any) {
      console.warn('Gemini insights generation error, using calculated metrics:', e.message);
    }
  }

  return res.json(fallbackInsights);
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// In Dev: Attach Vite middleware for SPA
// In Prod: Serve built dist files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FixNear Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
