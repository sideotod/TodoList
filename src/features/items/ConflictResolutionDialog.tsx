'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ItemView, ProposedCalendarItem } from '../../lib/repository';
import styles from './ConflictResolutionDialog.module.css';

type ResolutionAction = () => void | Promise<void>;

export type ConflictResolutionDialogProps = {
  item: ItemView;
  onKeepRemote: ResolutionAction;
  onUseLocal: ResolutionAction;
  onRestoreAsNew: ResolutionAction;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
};

const kindLabels = {
  event: '고정 일정',
  task: '하루 할 일',
  deadline: '마감',
  window: '신청 기간',
} satisfies Record<ProposedCalendarItem['kind'], string>;

function formatMoment(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
    timeZone,
  }).format(new Date(instant));
}

function formatTiming(item: ProposedCalendarItem): string {
  const timing = item.timing;
  if (timing.type === 'unscheduled') return '날짜 미정';
  if (timing.type === 'date') {
    if (!timing.startDate || timing.startDate === timing.endDate) return timing.endDate;
    return `${timing.startDate} ~ ${timing.endDate}`;
  }
  if (!timing.startAt) return timing.endAt ? formatMoment(timing.endAt, timing.timeZone) : '날짜 미정';
  return `${formatMoment(timing.startAt, timing.timeZone)} ~ ${timing.endAt ? formatMoment(timing.endAt, timing.timeZone) : '종료 미정'}`;
}

function SnapshotSummary({ item, label, status }: { item: ProposedCalendarItem; label: string; status?: string }) {
  const headingId = useId();
  const isPeriod = item.kind === 'deadline' || item.kind === 'window';

  return (
    <section aria-labelledby={headingId} className={styles.snapshot}>
      <h3 id={headingId}>{label}</h3>
      {status && <p className={styles.snapshotStatus}>{status}</p>}
      <p className={styles.itemTitle}>{item.title}</p>
      <dl className={styles.fields}>
        <dt>종류</dt><dd>{kindLabels[item.kind]}</dd>
        <dt>날짜·시각</dt><dd>{formatTiming(item)}</dd>
        {item.timing.type !== 'unscheduled' && <><dt>시간대</dt><dd>{item.timing.timeZone}</dd></>}
        {item.kind !== 'event' && <><dt>항목 완료</dt><dd>{item.completion === 'completed' ? '완료' : '미완료'}</dd></>}
        {isPeriod && <><dt>하위 체크리스트</dt><dd>{item.checklist.filter((entry) => entry.completed).length}/{item.checklist.length}개 완료</dd></>}
        {isPeriod && item.startCountdown && <><dt>시작 카운트다운</dt><dd>{item.startCountdown.enabled ? `시작 ${item.startCountdown.daysBefore}일 전부터 표시` : '표시 안 함'}</dd></>}
        {item.category && <><dt>분류</dt><dd>{item.category}</dd></>}
        {item.notes && <><dt>메모</dt><dd className={styles.notes}>{item.notes}</dd></>}
        {item.sourceUrl && <><dt>출처</dt><dd>{item.sourceUrl}</dd></>}
      </dl>
      {isPeriod && item.checklist.length > 0 && (
        <ul className={styles.checklist} aria-label={`${label} 하위 체크리스트`}>
          {item.checklist.map((entry) => <li key={entry.id}><span>{entry.completed ? '완료' : '미완료'}</span>{entry.title}</li>)}
        </ul>
      )}
    </section>
  );
}

export function ConflictResolutionDialog({ item, onKeepRemote, onUseLocal, onRestoreAsNew, onClose, busy = false, error = null }: ConflictResolutionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actionInFlight = useRef(false);
  const headingId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<{ operationId: string | undefined; message: string } | null>(null);
  const localDraft = item.localDraft;
  const conflictRemote = item.conflictRemote ?? localDraft?.remoteSnapshot ?? null;
  const remote = item.canonical && (!conflictRemote || item.canonical.revision > conflictRemote.revision) ? item.canonical : conflictRemote;
  const remoteDeleted = remote !== null && remote.deletedAt !== null;
  const localDeleted = localDraft?.mutationKind === 'delete';
  const canResolve = localDraft?.stage === 'conflicted' && remote !== null;
  const disabled = busy || pending;
  const errorMessage = error ?? (actionError?.operationId === localDraft?.operationId ? actionError?.message : null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  async function resolve(action: ResolutionAction) {
    if (actionInFlight.current || disabled || !canResolve) return;
    actionInFlight.current = true;
    setPending(true);
    setActionError(null);
    try {
      await action();
    } catch (failure) {
      const message = typeof failure === 'object' && failure !== null && 'message' in failure && typeof failure.message === 'string'
        ? failure.message
        : '충돌을 해결하지 못했습니다. 다시 시도해 주세요.';
      setActionError({ operationId: localDraft?.operationId, message });
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      aria-modal="true"
      aria-busy={disabled}
      onClick={(event) => { if (event.target === event.currentTarget && !disabled) onClose(); }}
      onCancel={(event) => { event.preventDefault(); if (!disabled) onClose(); }}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>동기화 충돌</p>
          <h2 id={headingId} ref={headingRef} tabIndex={-1}>어떤 내용을 유지할까요?</h2>
        </div>
        <button type="button" className={styles.close} aria-label="충돌 해결 닫기" disabled={disabled} onClick={onClose}>×</button>
      </header>
      <div className={styles.body}>
        <p id={descriptionId} className={styles.description}>
          {remoteDeleted
            ? '다른 기기에서 이 항목을 삭제했습니다. 삭제를 유지하거나 내 내용을 새 항목으로 복원할 수 있습니다. 새 항목으로 복원하면 새로운 ID로 저장됩니다.'
            : '다른 기기의 변경과 내 변경이 겹쳤습니다. 두 내용을 확인한 뒤 유지할 내용을 선택해 주세요. 선택 전까지 두 판본을 보존합니다.'}
        </p>
        <div className={styles.comparison}>
          <SnapshotSummary item={localDraft?.proposedSnapshot ?? item.display} label="내 변경" status={localDeleted ? '삭제 요청' : undefined} />
          {remote
            ? <SnapshotSummary item={remote} label="원격 내용" status={remoteDeleted ? '다른 기기에서 삭제됨' : undefined} />
            : <section className={styles.snapshot}><h3>원격 내용</h3><p>원격 판본을 확인할 수 없습니다. 항목을 다시 열어 주세요.</p></section>}
        </div>
        {localDraft?.baseSnapshot && (
          <details className={styles.base}>
            <summary>변경 전 기준 내용 보기</summary>
            <SnapshotSummary item={localDraft.baseSnapshot} label="변경 전 내용" />
          </details>
        )}
        {!canResolve && <p className={styles.error} role="alert">현재 해결할 충돌을 확인할 수 없습니다. 닫은 뒤 항목을 다시 열어 주세요.</p>}
        {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
        {disabled && <p className={styles.description} role="status">선택한 내용을 기기에 저장하고 있습니다.</p>}
      </div>
      <footer className={styles.footer}>
        <button type="button" className={styles.secondary} disabled={disabled} onClick={onClose}>나중에 결정</button>
        <div className={styles.choices}>
          <button type="button" className={styles.secondary} disabled={disabled || !canResolve} onClick={() => { void resolve(onKeepRemote); }}>{remoteDeleted ? '삭제 유지' : '원격 내용 유지'}</button>
          {remoteDeleted
            ? <button type="button" className={styles.primary} disabled={disabled || !canResolve} onClick={() => { void resolve(onRestoreAsNew); }}>새 항목으로 복원</button>
            : <button type="button" className={styles.primary} disabled={disabled || !canResolve} onClick={() => { void resolve(onUseLocal); }}>{localDeleted ? '내 삭제 다시 적용' : '내 변경 다시 적용'}</button>}
        </div>
      </footer>
    </dialog>
  );
}
