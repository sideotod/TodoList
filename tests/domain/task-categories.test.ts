import { describe, expect, it } from 'vitest';
import type { ItemView } from '../../src/domain/items';
import { DEFAULT_TASK_CATEGORY, getTaskCategoryColor, mergeTaskCategories, normalizeTaskCategories } from '../../src/domain/task-categories';
import { makeTask } from '../fixtures/items';

function view(task: ReturnType<typeof makeTask>): ItemView {
  return {
    display: task,
    canonical: null,
    localDraft: null,
    syncState: 'synced',
    snapshotSource: 'none',
    localSequence: null,
  };
}

describe('mergeTaskCategories', () => {
  it('keeps configured empty categories and appends categories inferred from tasks once', () => {
    const items = [
      view(makeTask({ id: 'task-research', category: '연구', categoryColor: 'violet' })),
      view(makeTask({ id: 'task-school', category: '수업', categoryColor: 'amber' })),
    ];

    expect(mergeTaskCategories(items, [
      { name: '생활', color: 'sage' },
      { name: '연구', color: 'blue' },
    ])).toEqual([
      DEFAULT_TASK_CATEGORY,
      { name: '생활', color: 'sage' },
      { name: '연구', color: 'blue' },
      { name: '수업', color: 'amber' },
    ]);
  });

  it('ignores blank configured names and deduplicates names case-insensitively', () => {
    expect(mergeTaskCategories([], [
      { name: ' 연구 ', color: 'teal' },
      { name: '연구', color: 'violet' },
      { name: '   ', color: 'sage' },
    ])).toEqual([DEFAULT_TASK_CATEGORY, { name: '연구', color: 'teal' }]);
  });

  it('keeps a built-in basic category for tasks without a saved category', () => {
    const items = [view(makeTask({ id: 'legacy-task' }))];

    expect(mergeTaskCategories(items)).toEqual([DEFAULT_TASK_CATEGORY]);
    expect(mergeTaskCategories([], [{ name: '기본', color: 'coral' }])).toEqual([DEFAULT_TASK_CATEGORY]);
  });

  it('accepts and resolves valid custom hex colors while ignoring invalid colors', () => {
    expect(normalizeTaskCategories([
      { name: '개인', color: '#3B82F6' },
      { name: '잘못된 색', color: '#xyz' },
    ])).toEqual([{ name: '개인', color: '#3B82F6' }]);
    expect(getTaskCategoryColor('#3B82F6').color).toBe('#3B82F6');
  });

  it('keeps category colors independent from the interface accent', () => {
    expect(getTaskCategoryColor('teal').color).toBe('#0B756B');
    expect(getTaskCategoryColor('violet').color).toBe('#7054A6');
    expect(getTaskCategoryColor('#3B82F6').color).toBe('#3B82F6');
  });
});
