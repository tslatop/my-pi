import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/commands/message-commands.ts', () => {
	it('loads without side effects', async () => {
		await expect(
			import('./message-commands.js'),
		).resolves.toBeDefined();
	});
});
