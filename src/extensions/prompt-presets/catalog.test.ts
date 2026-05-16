import { describe, expect, it } from 'vitest';

describe('src/extensions/prompt-presets/catalog.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./catalog.js')).resolves.toBeDefined();
	});
});
