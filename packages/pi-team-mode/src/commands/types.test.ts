import { describe, expect, it } from 'vitest';
import { current_team_id, type TeamCommandDeps } from './types.js';

describe('packages/pi-team-mode/src/commands/types.ts', () => {
	it('loads without side effects', async () => {
		await expect(import('./types.js')).resolves.toBeDefined();
	});

	it('returns the active team id', () => {
		expect(
			current_team_id({
				get_active_team_id: () => 'team-1',
			} as TeamCommandDeps),
		).toBe('team-1');
	});

	it('throws a useful error when no team is active', () => {
		expect(() =>
			current_team_id({
				get_active_team_id: () => undefined,
			} as TeamCommandDeps),
		).toThrow(/No active team/);
	});
});
