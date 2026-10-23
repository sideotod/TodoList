import type { EventCountdown, ItemKind } from '../../domain/items';

// Match PeriodCard's existing calculation, including legacy deadlines without focus.
export function getCountdownTargetLabel(kind: ItemKind, reference: EventCountdown['reference'] = 'start', focus?: 'start' | 'deadline'): '시작' | '종료' | '마감' {
  if (kind === 'event') return reference === 'end' ? '종료' : '시작';
  return kind === 'deadline' && focus === 'deadline' ? '마감' : '시작';
}

export function getCountdownWindowLabel(daysBefore: number): string {
  return daysBefore === 0 ? '0일 · 숫자 숨김' : `${daysBefore}일 전부터`;
}
