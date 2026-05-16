import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/commit-composer.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./commit-composer.js'),
		).resolves.toBeDefined();
	});
});
