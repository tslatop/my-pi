import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/command-utils.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./command-utils.js')).resolves.toBeDefined();
	});
});
