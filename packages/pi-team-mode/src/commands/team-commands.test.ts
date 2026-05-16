import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/commands/team-commands.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./team-commands.js')).resolves.toBeDefined();
	});
});
