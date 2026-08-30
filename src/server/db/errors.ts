export class PersistenceError extends Error {
  readonly code: 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'HYDRATION_FAILED' | 'WRITE_FAILED';

  constructor(
    code: PersistenceError['code'],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
  }
}

export function isPersistenceError(err: unknown): err is PersistenceError {
  return err instanceof PersistenceError;
}
