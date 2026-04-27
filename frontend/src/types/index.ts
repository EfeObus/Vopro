export type SopStatus = 'draft' | 'published' | 'needs_review' | 'archived';

export interface SopStep {
  id: string;
  order: number;
  title: string;
  description: string;
  application?: string;
  screenshot?: string;
  decision?: {
    question: string;
    branches: { label: string; goToStepId: string }[];
  };
}

export interface SopVersion {
  id: string;
  version: number;
  authoredBy: string;
  authoredAt: string;
  summary: string;
}

export interface Sop {
  id: string;
  title: string;
  description: string;
  status: SopStatus;
  ownerName: string;
  ownerInitials: string;
  tags: string[];
  steps: SopStep[];
  versions: SopVersion[];
  lastUpdated: string;
  contributors: number;
  runsObserved: number;
  averageDurationSec: number;
  confidence: number;
}

export interface DetectedWorkflow {
  id: string;
  title: string;
  application: string;
  occurrences: number;
  lastSeen: string;
  confidence: number;
  status: 'pending' | 'sop_generated' | 'dismissed';
}

export interface AnalyticsPoint {
  label: string;
  runs: number;
  sops: number;
}

export interface BottleneckRow {
  workflow: string;
  avgDurationSec: number;
  outlierDurationSec: number;
  occurrences: number;
}
