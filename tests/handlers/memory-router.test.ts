import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { routeMemory } from '../../src/handlers/memory-router.js';

describe('memory router', () => {
  it('retrieves for prior context, workspace artifacts, and failures', () => {
    assert.equal(routeMemory('Continue the same issue in src/config.ts').decision, 'retrieve');
    assert.equal(routeMemory('Why did the build fail?').decision, 'retrieve');
  });
  it('skips generic, translation, and unrelated prompts', () => {
    assert.equal(routeMemory('What is photosynthesis?').decision, 'skip');
    assert.equal(routeMemory('Translate hello to Chinese').decision, 'skip');
  });
  it('retrieves when a current tool failure is supplied', () => {
    assert.ok(routeMemory('help', 'npm test exited 1').reasons.includes('current-tool-failure'));
  });
});
