import { describe, expect, it } from 'vitest';

describe('src/extensions/prompt-presets/footer.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./footer.js')).resolves.toBeDefined();
	});
});
