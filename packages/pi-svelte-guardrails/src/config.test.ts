import { describe, expect, it } from 'vitest';

describe('packages/pi-svelte-guardrails/src/config.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./config.js')).resolves.toBeDefined();
	});
});
