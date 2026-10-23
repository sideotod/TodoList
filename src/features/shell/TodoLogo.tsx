import styles from './TodoLogo.module.css';

export function TodoLogo({ loading = false, variant = 'sidebar' }: { loading?: boolean; variant?: 'sidebar' | 'title' }) {
  return (
    <span aria-label="todo" className={styles.logo} data-loading={loading} data-testid={variant === 'title' ? 'todo-title-logo' : 'todo-logo'} data-variant={variant} role="img">
      <span aria-hidden="true" className={styles.mark}>✓</span>
      <span className={styles.word}>todo</span>
    </span>
  );
}
