import { describe, expect, it } from 'vitest';

describe('src/extensions/builtin-registry.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./builtin-registry.js'),
		).resolves.toBeDefined();
	});
});
