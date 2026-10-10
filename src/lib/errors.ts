import type { FieldIssue, RepositoryError, RepositoryErrorCode } from '../domain/items';

export function makeRepositoryError(
  code: RepositoryErrorCode,
  message: string,
  options: { retryable?: boolean; fieldIssues?: FieldIssue[] } = {},
): RepositoryError {
  return {
    code,
    message,
    retryable: options.retryable ?? false,
    ...(options.fieldIssues ? { fieldIssues: options.fieldIssues } : {}),
  };
}
