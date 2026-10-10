'use client';

import Image from 'next/image';
import styles from './TodoLogo.module.css';

export function TodoLogo({ loading = false }: { loading?: boolean }) {
  return (
    <Image
      alt="TODO"
      className={styles.logo}
      data-loading={loading}
      data-testid="todo-logo"
      height={887}
      src="/todo-logo-separated.png"
      width={1774}
    />
  );
}
