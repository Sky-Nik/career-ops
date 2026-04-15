export type Application = {
  id: number;
  number: number;
  date: string;
  company: string;
  role: string;
  status: string;
  score: number;
  score_raw: string;
  has_pdf: boolean;
  report_path: string | null;
  report_number: string | null;
  notes: string;
  job_url: string | null;
  synced_at: string;
};

export type Report = {
  id: number;
  report_number: string;
  report_path: string;
  content: string;
  archetype: string | null;
  tldr: string | null;
  remote: string | null;
  comp: string | null;
  synced_at: string;
};

export type StatusKey =
  | 'interview'
  | 'offer'
  | 'responded'
  | 'applied'
  | 'evaluated'
  | 'skip'
  | 'rejected'
  | 'discarded';

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  interview: 'Interview',
  offer: 'Offer',
  responded: 'Responded',
  applied: 'Applied',
  evaluated: 'Evaluated',
  skip: 'Skip',
  rejected: 'Rejected',
  discarded: 'Discarded',
};

export const STATUS_ORDER = [
  'interview', 'offer', 'responded', 'applied', 'evaluated', 'pending', 'skip', 'rejected', 'discarded',
];
