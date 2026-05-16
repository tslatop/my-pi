export type FileState =
	| 'staged'
	| 'changed'
	| 'mixed'
	| 'untracked'
	| 'conflicted';

export interface GitFile {
	path: string;
	index_status: string;
	worktree_status: string;
	state: FileState;
}

export interface GitStatus {
	branch: string;
	upstream?: string;
	ahead: number;
	behind: number;
	files: GitFile[];
}

export type DiffSection = 'staged' | 'unstaged';

export interface DiffHunk {
	section: DiffSection;
	line_index: number;
	header: string;
	patch: string;
}

export interface DiffView {
	path: string;
	lines: string[];
	hunks: DiffHunk[];
}

export interface RepoOverview {
	branches: string[];
	log: string[];
	stashes: string[];
	remotes: string[];
}

export const EMPTY_STATUS: GitStatus = {
	branch: 'unknown',
	ahead: 0,
	behind: 0,
	files: [],
};
