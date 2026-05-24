import { describe, expect, it } from 'vitest';
import { build_member_record } from './member-record.js';

describe('store member record helper', () => {
	it('preserves existing worktree metadata when fields are omitted', () => {
		const member = build_member_record(
			{ name: 'alice', status: 'running_attached' },
			{
				name: 'alice',
				role: 'teammate',
				status: 'idle',
				workspace_mode: 'worktree',
				worktree_path: '/repo/.worktrees/alice',
				branch: 'team/alice',
				last_seen_at: 'old',
				created_at: 'old',
				updated_at: 'old',
			},
			'now',
		);

		expect(member).toMatchObject({
			name: 'alice',
			status: 'running_attached',
			workspace_mode: 'worktree',
			worktree_path: '/repo/.worktrees/alice',
			branch: 'team/alice',
			created_at: 'old',
			updated_at: 'now',
		});
	});
});
