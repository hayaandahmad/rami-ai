// Quick validation: users normalization to canonical UsersValue
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { createEmptyProjectMemory } from '../src/types/projectMemory';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    fail++;
  }
}

console.log('\n=== Users Normalization Tests ===\n');

// Test 1: plain string → internal array
{
  const mem = createEmptyProjectMemory();
  applyExtractedFacts(mem, [{ fieldId: 'users', value: '150 employees', confidence: 'high' }]);
  check('String "150 employees" → internal', mem.users?.current?.value, { internal: ['150 employees'], external: [] });
}

// Test 2: string mentioning citizens → external
{
  const mem = createEmptyProjectMemory();
  applyExtractedFacts(mem, [{ fieldId: 'users', value: 'external citizens', confidence: 'high' }]);
  check('String "external citizens" → external', mem.users?.current?.value, { internal: [], external: ['external citizens'] });
}

// Test 3: array with mixed → classify each item
{
  const mem = createEmptyProjectMemory();
  applyExtractedFacts(mem, [{ fieldId: 'users', value: ['150 staff', 'external citizens portal'], confidence: 'high' }]);
  check('Mixed array → classified', mem.users?.current?.value, { internal: ['150 staff'], external: ['external citizens portal'] });
}

// Test 4: already correct shape → pass through
{
  const mem = createEmptyProjectMemory();
  applyExtractedFacts(mem, [{ fieldId: 'users', value: { internal: ['employees'], external: ['citizens'] }, confidence: 'high' }]);
  check('Object shape → preserved', mem.users?.current?.value, { internal: ['employees'], external: ['citizens'] });
}

// Test 5: empty string → rejected
{
  const mem = createEmptyProjectMemory();
  const result = applyExtractedFacts(mem, [{ fieldId: 'users', value: '', confidence: 'high' }]);
  check('Empty string → rejected', result.rejected.includes('users'), true);
}

console.log(`\n──────────────────────────────────────`);
console.log(`Passed: ${pass}  Failed: ${fail}`);
console.log(fail === 0 ? '\n✅ Users normalization tests passed.\n' : '\n❌ Some tests failed.\n');
process.exit(fail > 0 ? 1 : 0);

