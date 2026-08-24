#!/usr/bin/env npx tsx
/**
 * Rami Phase 1 — Local AI structured-output smoke test.
 *
 * Sends a BA-like opening message and verifies the local model returns
 * schema-valid structured JSON via Ollama's native constrained output.
 *
 * This test exercises the full chain:
 *   Rami code → RamiModelProvider → LocalModelProvider → Ollama → local Qwen3
 *
 * Usage:  npx tsx scripts/smoke-test-ai.ts
 *
 * Exit 0 = smoke test passed.
 * Exit 1 = failure (Ollama not running, model not installed, or bad output).
 */

import { LocalModelProvider } from '../src/server/ai/LocalModelProvider';
import { getModelManifest } from '../src/server/ai/modelManifest';

async function main() {
  console.log('\n=== Rami Local AI Smoke Test ===\n');

  let manifest;
  try {
    manifest = getModelManifest();
    console.log(`Manifest loaded. Provider: ${manifest.provider}, Default model: ${manifest.models.default}`);
  } catch (err) {
    console.error(`FAIL: Could not load model manifest.\n  ${err}`);
    process.exit(1);
  }

  const provider = new LocalModelProvider(manifest);

  console.log('\nRunning health check...');
  let health;
  try {
    health = await provider.healthCheck();
  } catch (err) {
    console.error(`FAIL: healthCheck() threw:\n  ${err}`);
    process.exit(1);
  }

  console.log(`  Endpoint reachable: ${health.endpointReachable}`);
  console.log(`  Default model available (${manifest.models.default}): ${health.defaultModelAvailable}`);
  console.log(`  Lightweight model available (${manifest.models.lightweight}): ${health.lightweightModelAvailable}`);
  console.log(`  Installed models: ${health.models.map(m => m.name).join(', ')}`);
  console.log(`  Smoke test (via healthCheck): ${health.smokeTestPassed ? 'PASSED' : 'FAILED'}`);
  if (health.smokeTestError) {
    console.log(`  Smoke test error: ${health.smokeTestError}`);
  }

  if (!health.endpointReachable) {
    console.error('\nFAIL: Ollama endpoint not reachable. Run: ollama serve');
    process.exit(1);
  }

  if (!health.defaultModelAvailable) {
    console.error(`\nFAIL: Default model '${manifest.models.default}' not installed. Run: npm run ai:setup`);
    process.exit(1);
  }

  // Additional stand-alone structured extraction test
  console.log('\nRunning stand-alone structured extraction...');
  const schema = {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'What kind of RFP is needed',
      },
      summary: {
        type: 'string',
        description: 'Brief summary of the request',
      },
      facts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key facts extracted from the message',
      },
    },
    required: ['intent', 'summary', 'facts'],
  };

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are Rami, a business analysis assistant. Extract structured information from the BA message.',
    },
    {
      role: 'user' as const,
      content:
        'We need to prepare an RFP for a new digital services portal for the Ministry of Digital Economy. ' +
        'This is a system implementation project. The current paper-based system is slow and error-prone. ' +
        'We need the system ready within 12 months.',
    },
  ];

  try {
    const result = await provider.extractStructured<{
      intent: string;
      summary: string;
      facts: string[];
    }>(messages, schema, { temperature: 0 });

    console.log(`\nStructured extraction result (${result.durationMs}ms, model: ${result.modelUsed}):`);
    console.log(`  intent : ${result.data.intent}`);
    console.log(`  summary: ${result.data.summary}`);
    console.log(`  facts  : [${result.data.facts.length} items]`);
    result.data.facts.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));

    const isValid =
      typeof result.data.intent === 'string' &&
      typeof result.data.summary === 'string' &&
      Array.isArray(result.data.facts);

    if (!isValid) {
      console.error('\nFAIL: Response did not match expected schema types.');
      process.exit(1);
    }

    if (result.data.intent.length === 0 || result.data.summary.length === 0) {
      console.error('\nFAIL: intent or summary is empty string.');
      process.exit(1);
    }

    console.log('\n✅ Smoke test PASSED — local Ollama returns schema-valid structured output.\n');
    process.exit(0);
  } catch (err) {
    console.error(`\nFAIL: extractStructured() threw:\n  ${err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
