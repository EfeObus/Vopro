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

export type IntegrationProvider =
  | 'google'
  | 'microsoft'
  | 'salesforce'
  | 'zendesk'
  | 'notion'
  | 'slack'
  | 'rest';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  settings: Record<string, unknown>;
  createdAt: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  inviterId: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** Only populated on the create response so the inviter can copy the link. */
  token?: string;
}

export interface InvitationPreview {
  email: string;
  role: UserRole;
  workspaceName: string;
}
