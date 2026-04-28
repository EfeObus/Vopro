/**
 * Deterministic mock data used when `VITE_API_BASE_URL` is unset (Vitest) or
 * for local UI demos. Keeps tests independent from the Rails API.
 */
import type {
  AnalyticsPoint,
  BottleneckRow,
  DetectedWorkflow,
  Integration,
  Sop,
  SopStep,
  SopVersion,
} from '@/types';

const now = '2026-04-01T12:00:00.000Z';

const ver = (id: string, summary: string): SopVersion => ({
  id,
  version: 1,
  authoredBy: 'Demo User',
  authoredAt: now,
  summary,
});

const stepsGeneric: SopStep[] = [
  {
    id: 'step_open',
    order: 1,
    title: 'Open CRM opportunity',
    description: 'Navigate to the opportunity record.',
    application: 'Salesforce',
  },
  {
    id: 'step_call',
    order: 2,
    title: 'Run discovery call',
    description: 'Capture BANT notes.',
    application: 'Salesforce',
  },
];

/** Order matters for tests: [0] & [1] used by SopDetailPage; titles match SopListPage tests. */
export const MOCK_SOPS: Sop[] = [
  // [0] SopDetailPage — draft, inline editor / steps
  {
    id: 'sop_mock_0',
    title: 'Lead qualification call',
    description: 'Standard flow for inbound leads.',
    status: 'draft',
    ownerName: 'Alex Rivera',
    ownerInitials: 'AR',
    tags: ['sales', 'crm'],
    steps: stepsGeneric,
    versions: [ver('ver_lq', 'Initial draft')],
    lastUpdated: now,
    contributors: 2,
    runsObserved: 42,
    averageDurationSec: 320,
    confidence: 0.88,
  },
  // [1] SopDetailPage — decision branches
  {
    id: 'sop_mock_1',
    title: 'AP invoice review',
    description: 'Accounts payable approval ladder.',
    status: 'published',
    ownerName: 'Jordan Lee',
    ownerInitials: 'JL',
    tags: ['finance'],
    steps: [
      {
        id: 'step_decision',
        order: 1,
        title: 'Threshold check',
        description: 'Compare invoice total to policy.',
        application: 'NetSuite',
        decision: {
          question: 'Is invoice ≥ $25,000?',
          branches: [
            { label: 'Yes', goToStepId: 'step_escalate' },
            { label: 'No', goToStepId: 'step_pay' },
          ],
        },
      },
      {
        id: 'step_escalate',
        order: 2,
        title: 'Director approval',
        description: 'Escalate per policy.',
      },
      {
        id: 'step_pay',
        order: 3,
        title: 'Schedule payment',
        description: 'Pay within terms.',
      },
    ],
    versions: [ver('ver_ap', 'Published v1')],
    lastUpdated: now,
    contributors: 3,
    runsObserved: 128,
    averageDurationSec: 540,
    confidence: 0.91,
  },
  // SopListPage — seeded library titles
  {
    id: 'sop_ent_salesforce',
    title: 'Onboard a new enterprise customer in Salesforce',
    description: 'RevOps handoff from closed-won.',
    status: 'published',
    ownerName: 'Pat Kim',
    ownerInitials: 'PK',
    tags: ['salesforce'],
    steps: [
      {
        id: 'oe_1',
        order: 1,
        title: 'Create account hierarchy',
        description: 'Align parent/child accounts.',
        application: 'Salesforce',
      },
    ],
    versions: [ver('ver_oe', 'v1')],
    lastUpdated: now,
    contributors: 4,
    runsObserved: 56,
    averageDurationSec: 900,
    confidence: 0.85,
  },
  {
    id: 'sop_payroll_gusto',
    title: 'Bi-weekly payroll close in Gusto',
    description: 'Payroll accounting close checklist.',
    status: 'draft',
    ownerName: 'Taylor Morgan',
    ownerInitials: 'TM',
    tags: ['payroll'],
    steps: [
      {
        id: 'pr_1',
        order: 1,
        title: 'Pull payroll register',
        description: 'Export from Gusto.',
        application: 'Gusto',
      },
    ],
    versions: [ver('ver_pr', 'Draft')],
    lastUpdated: now,
    contributors: 2,
    runsObserved: 11,
    averageDurationSec: 480,
    confidence: 0.79,
  },
  {
    id: 'sop_zendesk_t1',
    title: 'Tier-1 support ticket triage in Zendesk',
    description: 'First-line ticket handling.',
    status: 'published',
    ownerName: 'Riley Ng',
    ownerInitials: 'RN',
    tags: ['support'],
    steps: [
      {
        id: 'zd_1',
        order: 1,
        title: 'Acknowledge SLA',
        description: 'Respond within policy.',
        application: 'Zendesk',
      },
    ],
    versions: [ver('ver_zd', 'Live')],
    lastUpdated: now,
    contributors: 6,
    runsObserved: 210,
    averageDurationSec: 240,
    confidence: 0.93,
  },
  {
    id: 'sop_mock_archive',
    title: 'Customer onboarding checklist',
    description: 'Post-sale checklist.',
    status: 'archived',
    ownerName: 'Sam Chen',
    ownerInitials: 'SC',
    tags: ['success'],
    steps: [
      {
        id: 's2_a',
        order: 1,
        title: 'Kickoff email',
        description: 'Send welcome pack.',
      },
    ],
    versions: [ver('ver_arc', 'Archived baseline')],
    lastUpdated: now,
    contributors: 1,
    runsObserved: 9,
    averageDurationSec: 120,
    confidence: 0.72,
  },
];

export const MOCK_ANALYTICS: AnalyticsPoint[] = [
  { label: 'Mon', runs: 12, sops: 4 },
  { label: 'Tue', runs: 18, sops: 5 },
  { label: 'Wed', runs: 9, sops: 3 },
  { label: 'Thu', runs: 22, sops: 6 },
  { label: 'Fri', runs: 15, sops: 4 },
];

export const MOCK_BOTTLENECKS: BottleneckRow[] = [
  {
    workflow: 'Invoice approval',
    avgDurationSec: 890,
    outlierDurationSec: 3600,
    occurrences: 34,
  },
  {
    workflow: 'Ticket escalation',
    avgDurationSec: 620,
    outlierDurationSec: 2400,
    occurrences: 21,
  },
];

export const MOCK_DETECTED: DetectedWorkflow[] = [
  {
    id: 'wf_mock_1',
    title: 'Zendesk → Slack handoff',
    application: 'Zendesk',
    occurrences: 14,
    lastSeen: now,
    confidence: 0.82,
    status: 'pending',
  },
  {
    id: 'wf_mock_2',
    title: 'Spreadsheet reconciliation',
    application: 'Excel',
    occurrences: 6,
    lastSeen: now,
    confidence: 0.71,
    status: 'pending',
  },
];

/** Matches IntegrationsPage tests: Google + Salesforce connected; Microsoft disconnected. */
export const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: 'int_google',
    provider: 'google',
    status: 'connected',
    settings: {},
    createdAt: now,
  },
  {
    id: 'int_salesforce',
    provider: 'salesforce',
    status: 'connected',
    settings: {},
    createdAt: now,
  },
];
