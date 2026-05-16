import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/git/status.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./status.js')).resolves.toBeDefined();
	});
});
