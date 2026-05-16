import { describe, expect, it } from 'vitest';

describe('packages/pi-tui-modal/src/modal/show.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./show.js')).resolves.toBeDefined();
	});
});
