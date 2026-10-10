import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ItemView, PendingDraft } from '../../src/domain/items';
import { ConflictResolutionDialog } from '../../src/features/items/ConflictResolutionDialog';
import { makeTask, withCanonicalMetadata } from '../fixtures/items';

function makeConflictView(options: { remoteDeleted?: boolean; canonicalRevision?: number } = {}): ItemView {
  const local = makeTask({ title: '이 기기 수정' });
  const base = makeTask({ title: '기준 내용' });
  const remoteProposal = makeTask({ title: options.remoteDeleted ? '삭제된 원격 일정' : '다른 기기 수정' });
  const canonical = withCanonicalMetadata(remoteProposal, {
    revision: options.canonicalRevision ?? 2,
    deletedAt: options.remoteDeleted ? '2026-10-03T01:00:00.000Z' : null,
  });
  const draft: PendingDraft = {
    uid: 'user-1',
    itemId: local.id,
    localSequence: 2,
    operationId: 'op-local',
    predecessorOperationId: null,
    baseRevision: 1,
    baseSnapshot: base,
    proposedSnapshot: local,
    mutationKind: 'upsert',
    stage: 'conflicted',
    remoteSnapshot: withCanonicalMetadata(makeTask({ title: '오래된 원격 판본' }), { revision: 1 }),
    payloadDigest: 'b'.repeat(64),
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-03T01:00:00.000Z',
  };
  return {
    display: local,
    canonical,
    localDraft: draft,
    syncState: 'conflict',
    conflictRemote: draft.remoteSnapshot,
    snapshotSource: 'server',
    localSequence: 2,
  };
}

function render(item: ItemView): string {
  const callbacks = {
    item,
    onKeepRemote: vi.fn(),
    onUseLocal: vi.fn(),
    onRestoreAsNew: vi.fn(),
    onClose: vi.fn(),
  };
  return renderToStaticMarkup(createElement(ConflictResolutionDialog, callbacks));
}

describe('conflict resolution dialog', () => {
  it('compares the base, local, and latest remote versions', () => {
    const markup = render(makeConflictView());
    expect(markup).toContain('기준 내용');
    expect(markup).toContain('이 기기 수정');
    expect(markup).toContain('다른 기기 수정');
    expect(markup).toContain('내 변경 다시 적용');
    expect(markup).toContain('원격 내용 유지');
  });

  it('uses the newer remote tombstone and offers restore without replaying over deletion', () => {
    const markup = render(makeConflictView({ remoteDeleted: true, canonicalRevision: 3 }));
    expect(markup).toContain('다른 기기에서 삭제됨');
    expect(markup).not.toContain('이 기기 내용 사용');
    expect(markup).toContain('새 항목으로 복원');
  });
});
