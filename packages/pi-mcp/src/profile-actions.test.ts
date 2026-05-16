import { describe, expect, it } from 'vitest';

describe('packages/pi-mcp/src/profile-actions.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./profile-actions.js'),
		).resolves.toBeDefined();
	});
});
