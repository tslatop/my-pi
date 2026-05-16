import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/process-identity.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./process-identity.js'),
		).resolves.toBeDefined();
	});
});
