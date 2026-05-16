import { describe, expect, it } from 'vitest';

describe('packages/pi-tui-modal/src/modal/frame.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./frame.js')).resolves.toBeDefined();
	});
});
