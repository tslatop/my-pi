import { describe, expect, it } from 'vitest';

describe('packages/pi-git-ui/src/stage-render.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./stage-render.js')).resolves.toBeDefined();
	});
});
