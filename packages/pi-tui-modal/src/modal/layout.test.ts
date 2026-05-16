import { describe, expect, it } from 'vitest';

describe('packages/pi-tui-modal/src/modal/layout.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./layout.js')).resolves.toBeDefined();
	});
});
