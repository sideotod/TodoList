import { describe, expect, it } from 'vitest';
import type { ItemView, ProposedCalendarItem } from '../../src/domain/items';
import { getTaskLinkDetachments } from '../../src/features/items/task-link-mutations';
import { makeDeadline, makeTask, withCanonicalMetadata } from '../fixtures/items';

const view = (display: ProposedCalendarItem): ItemView => ({
  display,
  canonical: withCanonicalMetadata(display),
  localDraft: null,
  syncState: 'synced',
  snapshotSource: 'server',
  localSequence: null,
});

describe('stable checklist task links', () => {
  it('detaches linked rows with the latest task title and completion before task deletion', () => {
    const task = view(makeTask({ id: 'linked-task', title: '최신 제목', completion: 'completed' }));
    const period = view(makeDeadline({ checklist: [
      { id: 'linked', title: '오래된 제목', completed: false, linkedTaskId: 'linked-task' },
      { id: 'independent', title: '독립 항목', completed: false },
    ] }));

    const updates = getTaskLinkDetachments([task, period], 'linked-task');

    expect(updates).toHaveLength(1);
    expect(updates[0]?.proposal).toMatchObject({
      kind: 'deadline',
      checklist: [
        { id: 'linked', title: '최신 제목', completed: true },
        { id: 'independent', title: '독립 항목', completed: false },
      ],
    });
    const proposal = updates[0]?.proposal;
    expect(proposal?.kind === 'deadline' ? proposal.checklist[0] : null).not.toHaveProperty('linkedTaskId');
  });
});
