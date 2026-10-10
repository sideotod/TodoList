import type { CalendarItem, PendingDraft, RepositoryError } from '../../domain/items';

export type MutationReceipt = {
  itemId: string;
  payloadDigest: string;
  resultRevision: number;
  createdAt: string;
};
export type RemoteSnapshot = {
  items: CalendarItem[];
  fromCache: boolean;
  hasPendingWrites: boolean;
  receivedAt: string;
};
export type RemoteCommitResult =
  | { status: 'applied'; receipt: MutationReceipt; remote: CalendarItem }
  | { status: 'already-applied'; receipt: MutationReceipt; remote: CalendarItem }
  | { status: 'conflict'; remote: CalendarItem };
export interface RemoteStore {
  subscribe(uid: string, onSnapshot: (value: RemoteSnapshot) => void, onError: (error: RepositoryError) => void): () => void;
  commit(uid: string, draft: PendingDraft): Promise<RemoteCommitResult>;
  clearReadCache(): Promise<void>;
}

export type JournalHead = {
  uid: string;
  itemId: string;
  localSequence: number;
  activeOperationId: string | null;
};
export type ConflictResolution = {
  uid: string;
  resolutionId: string;
  itemId: string;
  choice: 'keep-remote' | 'use-local' | 'edit' | 'restore-as-new';
  drafts: PendingDraft[];
  remoteSnapshot: CalendarItem;
  replacementOperationId: string | null;
  status: 'pending' | 'confirmed';
  createdAt: string;
};
export type JournalSnapshot = { drafts: PendingDraft[]; heads: JournalHead[]; resolutions: ConflictResolution[] };
export type JournalSaveResult =
  | { status: 'queued'; mutation: PendingDraft }
  | { status: 'cancelled'; itemId: string }
  | { status: 'stale-local'; current: PendingDraft | null };
export type SuccessorReplacement = { expectedOperationId: string; mutation: PendingDraft };
export interface JournalStore {
  read(uid: string): Promise<JournalSnapshot>;
  save(mutation: PendingDraft, expectedLocalSequence: number | null): Promise<JournalSaveResult>;
  markSending(uid: string, operationId: string): Promise<PendingDraft | null>;
  acknowledge(uid: string, operationId: string, result: Exclude<RemoteCommitResult, { status: 'conflict' }>, successor?: SuccessorReplacement): Promise<'acknowledged' | 'stale-local' | 'missing'>;
  markConflict(uid: string, operationId: string, remote: CalendarItem): Promise<void>;
  resolve(resolution: ConflictResolution, expectedLocalSequence: number, replacement: PendingDraft | null): Promise<JournalSaveResult | { status: 'resolved' }>;
  clear(uid: string, expected?: JournalSnapshot): Promise<'cleared' | 'stale-local'>;
  subscribe(uid: string, onChange: () => void): () => void;
  close(): void;
}
