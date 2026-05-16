import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/commands/runner-commands.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./runner-commands.js'),
		).resolves.toBeDefined();
	});
});
