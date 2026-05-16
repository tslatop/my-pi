import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/git/errors.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./errors.js')).resolves.toBeDefined();
	});
});
