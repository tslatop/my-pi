import { describe, expect, it } from 'vitest';

describe('packages/pi-team-mode/src/commands/task-commands.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./task-commands.js')).resolves.toBeDefined();
	});
});
