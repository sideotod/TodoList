'use client';

import styles from './LocalSaveStatus.module.css';

export type LocalSavePhase = 'idle' | 'saving' | 'saved' | 'error';

type LocalSaveStatusProps = {
  phase: LocalSavePhase;
  message?: string;
};

export function LocalSaveStatus({ phase, message }: LocalSaveStatusProps) {
  if (phase === 'idle') return null;
  const error = phase === 'error';
  const text = error ? message ?? '저장하지 못했습니다.' : phase === 'saving' ? '저장 중…' : '기기에 저장됨';
  return <p className={`${styles.status} ${error ? styles.error : ''}`} role={error ? 'alert' : 'status'}>{text}</p>;
}
