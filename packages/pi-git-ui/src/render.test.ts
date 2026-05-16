import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/render.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./render.js')).resolves.toBeDefined();
	});
});
