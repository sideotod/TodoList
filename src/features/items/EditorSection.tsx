'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './ItemEditor.module.css';

export function EditorSection({ title, summary, invalid = false, children }: {
  title: string;
  summary: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const open = expanded || invalid;

  return (
    <section className={styles.disclosure}>
      <button aria-controls={id} aria-expanded={open} className={styles.disclosureToggle} onClick={() => setExpanded(!open)} type="button">
        <span>{title}<small>{summary}</small></span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div className={styles.disclosureContent} hidden={!open} id={id}>{children}</div>
    </section>
  );
}
