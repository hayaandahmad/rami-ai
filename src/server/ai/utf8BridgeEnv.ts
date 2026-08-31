/**
 * Child-process environment for the Modal Python bridge on Windows.
 * Ensures UTF-8 stdin/stdout when the parent shell uses a legacy code page.
 */
export function buildModalBridgeEnv(
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...base,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
  };
}
