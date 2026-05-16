import { describe, expect, it } from 'vitest';

describe('src/extensions/prompt-presets/defaults.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./defaults.js')).resolves.toBeDefined();
	});
});
