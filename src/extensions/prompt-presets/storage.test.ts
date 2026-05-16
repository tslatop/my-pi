import { describe, expect, it } from 'vitest';

describe('src/extensions/prompt-presets/storage.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./storage.js')).resolves.toBeDefined();
	});
});
