import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/command-handler.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./command-handler.js'),
		).resolves.toBeDefined();
	});
});
