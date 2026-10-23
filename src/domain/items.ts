import type { TaskCategoryColor } from './task-categories';

export type ItemKind = 'event' | 'task' | 'deadline' | 'window';
export type Completion = 'pending' | 'completed';
export type DateOnly = string;
export type InstantIso = string;
export type MutationKind = 'upsert' | 'delete';

export type UnscheduledTiming = { type: 'unscheduled' };
export type DateTiming = {
  type: 'date';
  startDate: DateOnly | null;
  endDate: DateOnly;
  timeZone: string;
};
export type TimeTiming = {
  type: 'time';
  startAt: InstantIso | null;
  endAt: InstantIso | null;
  timeZone: string;
};
export type ItemTiming = UnscheduledTiming | DateTiming | TimeTiming;

export type PeriodChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
  linkedTaskId?: string;
};
export type ChecklistStatus =
  | { kind: 'none'; total: 0 }
  | { kind: 'incomplete'; remaining: number; total: number }
  | { kind: 'complete'; remaining: 0; total: number };
export type StartCountdownDisplay = {
  enabled: boolean;
  daysBefore: number;
};
export type EventCountdown = StartCountdownDisplay & {
  reference: 'start' | 'end';
};
export type WeeklyRecurrence = {
  frequency: 'weekly';
  daysOfWeek: number[];
  untilDate: DateOnly | null;
};
export type ImportSource = {
  uid: string;
  occurrenceKey: string;
  componentFingerprint: string;
};

export type ItemFields = {
  id: string;
  title: string;
  category?: string;
  categoryColor?: TaskCategoryColor;
  notes?: string;
  sourceUrl?: string;
  importSource?: ImportSource;
  revision: number;
  updatedAt: InstantIso;
  deletedAt: InstantIso | null;
  lastMutationId: string;
  lastMutationDigest: string;
};
export type PeriodFields = {
  checklist: PeriodChecklistItem[];
  startCountdown: StartCountdownDisplay | null;
  focus?: 'start' | 'deadline';
};

export type EventItem = ItemFields & {
  kind: 'event';
  countdown?: EventCountdown;
  showInProgressSummary?: boolean;
  recurrence?: WeeklyRecurrence;
  completion?: never;
  checklist?: never;
  startCountdown?: never;
  timing:
    | (DateTiming & { startDate: DateOnly })
    | (TimeTiming & { startAt: InstantIso; endAt: InstantIso | null });
};
export type TaskItem = ItemFields & {
  kind: 'task';
  timing:
    | UnscheduledTiming
    | (DateTiming & { startDate: null })
    | (TimeTiming & { startAt: null; endAt: InstantIso });
  completion: Completion;
  checklist?: never;
  startCountdown?: never;
};
export type DeadlineItem = ItemFields &
  PeriodFields & {
    kind: 'deadline';
    timing:
      | DateTiming
      | (TimeTiming & { endAt: InstantIso });
    completion: Completion;
  };
export type WindowItem = ItemFields &
  PeriodFields & {
    kind: 'window';
    timing:
      | (DateTiming & { startDate: DateOnly })
      | (TimeTiming & { startAt: InstantIso });
    completion: Completion;
    startCountdown: StartCountdownDisplay;
  };

export type CalendarItem = EventItem | TaskItem | DeadlineItem | WindowItem;
type ServerMetadata =
  | 'revision'
  | 'updatedAt'
  | 'deletedAt'
  | 'lastMutationId'
  | 'lastMutationDigest';
export type ProposedEventItem = Omit<EventItem, ServerMetadata>;
export type ProposedTaskItem = Omit<TaskItem, ServerMetadata>;
export type ProposedDeadlineItem = Omit<DeadlineItem, ServerMetadata>;
export type ProposedWindowItem = Omit<WindowItem, ServerMetadata>;
export type ProposedCalendarItem = CalendarItem extends infer Item
  ? Item extends CalendarItem
    ? Omit<Item, ServerMetadata>
    : never
  : never;

export type DraftStage = 'queued' | 'sending' | 'conflicted';
export type PendingDraft = {
  uid: string;
  itemId: string;
  localSequence: number;
  operationId: string;
  predecessorOperationId: string | null;
  baseRevision: number | null;
  baseSnapshot: ProposedCalendarItem | null;
  proposedSnapshot: ProposedCalendarItem;
  mutationKind: MutationKind;
  stage: DraftStage;
  remoteSnapshot?: CalendarItem;
  payloadDigest: string;
  createdAt: InstantIso;
  updatedAt: InstantIso;
};
export type DraftInput = {
  itemId: string;
  expectedLocalSequence: number | null;
  baseRevision: number | null;
  baseSnapshot: ProposedCalendarItem | null;
  mutationKind: MutationKind;
  proposedSnapshot: ProposedCalendarItem;
};
export type ItemView = {
  display: ProposedCalendarItem;
  canonical: CalendarItem | null;
  localDraft: PendingDraft | null;
  syncState:
    | 'synced'
    | 'offline-draft'
    | 'syncing'
    | 'conflict'
    | 'offline-read-only';
  conflictRemote?: CalendarItem;
  snapshotSource: 'server' | 'cache' | 'none';
  localSequence: number | null;
};

export type FieldIssue = {
  path: string;
  code: string;
  message: string;
};
export type ValidationResult<Value> =
  | { valid: true; value: Value }
  | { valid: false; issues: FieldIssue[] };
export type RepositoryErrorCode =
  | 'persistence'
  | 'auth'
  | 'validation'
  | 'permission'
  | 'quota'
  | 'integrity';
export type RepositoryError = {
  code: RepositoryErrorCode;
  message: string;
  retryable: boolean;
  fieldIssues?: FieldIssue[];
};
