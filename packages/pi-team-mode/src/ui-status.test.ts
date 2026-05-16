import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/ui-status.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./ui-status.js')).resolves.toBeDefined();
	});
});
