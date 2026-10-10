import type { ReactNode } from 'react';
import styles from './SettingsSection.module.css';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={styles.section}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
