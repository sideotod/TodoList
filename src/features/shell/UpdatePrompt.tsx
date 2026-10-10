'use client';

import { useState } from 'react';
import type { UpdateBlockReason } from '../../pwa/update-policy';
import styles from './UpdatePrompt.module.css';

type UpdatePromptProps = {
  onApply: () => UpdateBlockReason | null;
  onDismiss: () => void;
};

const blockedMessages: Record<UpdateBlockReason, string> = {
  'dirty-form': '저장하지 않은 입력이 있어요. 먼저 편집을 저장하거나 닫아 주세요.',
  'write-in-flight': '기기에 저장 중입니다. 잠시 후 다시 시도해 주세요.',
  'journal-unavailable': '기기 저장 상태를 확인할 수 없어 업데이트를 미뤘어요.',
  'confirmation-required': '업데이트 버튼을 눌러 적용해 주세요.',
  'no-waiting-worker': '대기 중인 업데이트가 없습니다.',
  'no-active-worker': '앱을 새 버전으로 다시 열면 업데이트가 적용됩니다.',
};

export function UpdatePrompt({ onApply, onDismiss }: UpdatePromptProps) {
  const [message, setMessage] = useState('');

  function apply() {
    const reason = onApply();
    if (reason) setMessage(blockedMessages[reason]);
  }

  return (
    <aside aria-label="앱 업데이트" className={styles.prompt} role="status">
      <div className={styles.copy}>
        <strong>새 버전을 사용할 수 있어요</strong>
        <span>화면 입력과 기기 저장 상태를 확인한 뒤 적용합니다.</span>
        {message && <span className={styles.message} role="alert">{message}</span>}
      </div>
      <div className={styles.actions}>
        <button className={styles.apply} onClick={apply} type="button">지금 업데이트</button>
        <button className={styles.dismiss} onClick={onDismiss} type="button">나중에</button>
      </div>
    </aside>
  );
}
