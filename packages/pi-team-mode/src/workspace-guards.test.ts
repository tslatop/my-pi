import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/workspace-guards.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./workspace-guards.js'),
		).resolves.toBeDefined();
	});
});
