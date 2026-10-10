import type { ReactNode } from 'react';
import styles from './SettingsControl.module.css';

export function SettingsControl({ label, description, control }: { label: string; description?: string; control: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.copy}>
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className={styles.control}>{control}</div>
    </div>
  );
}
