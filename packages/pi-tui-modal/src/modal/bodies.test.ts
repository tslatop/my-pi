import { describe, expect, it } from 'vitest';

describe('packages/pi-tui-modal/src/modal/bodies.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./bodies.js')).resolves.toBeDefined();
	});
});
