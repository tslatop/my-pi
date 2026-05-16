import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/git/overview.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./overview.js')).resolves.toBeDefined();
	});
});
