import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/git/operations.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./operations.js')).resolves.toBeDefined();
	});
});
