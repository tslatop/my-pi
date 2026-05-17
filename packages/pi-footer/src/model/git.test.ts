import { describe, expect, it } from 'vitest';
import { format_git_summary } from './git.js';

describe('format_git_summary', () => {
	it('uses nerd font git glyphs for branch and worktree state', () => {
		expect(
			format_git_summary({
				branch: 'main',
				dirty: 2,
				staged: 1,
				untracked: 3,
				ahead: 4,
				behind: 5,
			}),
		).toBe(' main 2 1 3 ⇡4 ⇣5');
	});
});
