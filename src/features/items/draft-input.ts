import type { CalendarItem, DraftInput, ItemView, ProposedCalendarItem } from '../../domain/items';

export function createDraftInput(
  item: ItemView,
  proposedSnapshot: ProposedCalendarItem,
  mutationKind: DraftInput['mutationKind'] = 'upsert',
): DraftInput {
  const baseSnapshot = item.localDraft
    ? item.localDraft.baseSnapshot
    : item.canonical ? toProposedCalendarItem(item.canonical) : null;
  return {
    itemId: proposedSnapshot.id,
    expectedLocalSequence: item.localSequence,
    baseRevision: item.localDraft ? item.localDraft.baseRevision : item.canonical?.revision ?? null,
    baseSnapshot,
    mutationKind,
    proposedSnapshot,
  };
}

export function toProposedCalendarItem(item: CalendarItem): ProposedCalendarItem {
  const { revision, updatedAt, deletedAt, lastMutationId, lastMutationDigest, ...proposal } = item;
  void revision;
  void updatedAt;
  void deletedAt;
  void lastMutationId;
  void lastMutationDigest;
  return proposal;
}
