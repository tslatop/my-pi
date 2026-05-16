import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/team-modals.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./team-modals.js')).resolves.toBeDefined();
	});
});
