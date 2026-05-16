import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec_file = promisify(execFile);

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

async function git(args: string[], cwd: string): Promise<string> {
	const { stdout } = await exec_file('git', args, {
		cwd,
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 8,
	});
	return stdout;
}

async function git_with_input(
	args: string[],
	cwd: string,
	input: string,
): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn('git', args, { cwd, stdio: 'pipe' });
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolve(stdout);
			else
				reject(new Error(stderr || `git exited with status ${code}`));
		});
		child.stdin.end(input);
	});
}

export async function read_status(cwd: string): Promise<GitStatus> {
	const [branch, upstream, raw] = await Promise.all([
		git(['branch', '--show-current'], cwd).catch(() => 'detached'),
		git(
			[
				'rev-parse',
				'--abbrev-ref',
				'--symbolic-full-name',
				'@{upstream}',
			],
			cwd,
		).catch(() => ''),
		git(['status', '--porcelain=v1', '-z'], cwd),
	]);
	const counts = upstream.trim()
		? await read_ahead_behind(cwd)
		: { ahead: 0, behind: 0 };

	return {
		branch: branch.trim() || 'detached',
		upstream: upstream.trim() || undefined,
		...counts,
		files: parse_porcelain_z(raw),
	};
}

async function read_ahead_behind(
	cwd: string,
): Promise<{ ahead: number; behind: number }> {
	const raw = await git(
		['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
		cwd,
	).catch(() => '');
	const [behind = '0', ahead = '0'] = raw.trim().split(/\s+/);
	return { ahead: Number(ahead) || 0, behind: Number(behind) || 0 };
}

export function parse_porcelain_z(raw: string): GitFile[] {
	if (!raw) return [];
	const entries = raw.split('\0').filter(Boolean);
	const files: GitFile[] = [];

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i]!;
		const index_status = entry[0] ?? ' ';
		const worktree_status = entry[1] ?? ' ';
		let path = entry.slice(3);

		if (index_status === 'R' || index_status === 'C') {
			const original = entries[++i];
			if (original) path = `${original} → ${path}`;
		}

		files.push({
			path,
			index_status,
			worktree_status,
			state: get_file_state(index_status, worktree_status),
		});
	}

	return files.sort(
		(a, b) =>
			state_rank(a.state) - state_rank(b.state) ||
			a.path.localeCompare(b.path),
	);
}

function get_file_state(
	index_status: string,
	worktree_status: string,
): FileState {
	if (index_status === '?' && worktree_status === '?')
		return 'untracked';
	if (
		index_status === 'U' ||
		worktree_status === 'U' ||
		(index_status === 'A' && worktree_status === 'A') ||
		(index_status === 'D' && worktree_status === 'D')
	) {
		return 'conflicted';
	}
	const has_index = index_status !== ' ';
	const has_worktree = worktree_status !== ' ';
	if (has_index && has_worktree) return 'mixed';
	if (has_index) return 'staged';
	return 'changed';
}

function state_rank(state: FileState): number {
	return [
		'conflicted',
		'changed',
		'untracked',
		'mixed',
		'staged',
	].indexOf(state);
}

function git_path(file: GitFile): string {
	const arrow = ' → ';
	return file.path.includes(arrow)
		? file.path.split(arrow).at(-1)!
		: file.path;
}

export async function stage_file(
	cwd: string,
	file: GitFile,
): Promise<void> {
	await git(['add', '--', git_path(file)], cwd);
}

export async function unstage_file(
	cwd: string,
	file: GitFile,
): Promise<void> {
	await git(['restore', '--staged', '--', git_path(file)], cwd);
}

export async function toggle_file(
	cwd: string,
	file: GitFile,
): Promise<void> {
	if (file.state === 'mixed') {
		throw new Error(
			'Partial file: space is disabled. Use s to stage worktree changes or x to unstage staged changes.',
		);
	}
	if (file.state === 'conflicted') {
		throw new Error(
			'Conflicted file: resolve conflicts, then stage explicitly with s.',
		);
	}
	if (file.state === 'staged') await unstage_file(cwd, file);
	else await stage_file(cwd, file);
}

export async function stage_all(cwd: string): Promise<void> {
	await git(['add', '--all'], cwd);
}

export async function unstage_all(cwd: string): Promise<void> {
	await git(['restore', '--staged', '--', ':/'], cwd);
}

export async function commit(
	cwd: string,
	message: string,
): Promise<void> {
	await git(['commit', '-m', message], cwd);
}

export async function read_repo_overview(
	cwd: string,
): Promise<RepoOverview> {
	const [branches, log, stashes, remotes] = await Promise.all([
		git(
			['branch', '--all', '--format=%(HEAD) %(refname:short)'],
			cwd,
		).catch((error) => format_git_error(error)),
		git(['log', '--oneline', '--decorate', '-n', '8'], cwd).catch(
			(error) => format_git_error(error),
		),
		git(['stash', 'list', '-n', '8'], cwd).catch((error) =>
			format_git_error(error),
		),
		git(['remote', '-v'], cwd).catch((error) =>
			format_git_error(error),
		),
	]);
	return {
		branches: split_non_empty(branches),
		log: split_non_empty(log),
		stashes: split_non_empty(stashes),
		remotes: split_non_empty(remotes),
	};
}

function split_non_empty(raw: string): string[] {
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

export async function read_diff(
	cwd: string,
	file: GitFile,
): Promise<DiffView> {
	const path = git_path(file);
	if (file.state === 'untracked') {
		return {
			path: file.path,
			lines: [
				'Untracked file',
				'',
				'Press space or s to stage it.',
				'No diff is available until Git starts tracking the path.',
			],
			hunks: [],
		};
	}

	const lines: string[] = [];
	const hunks: DiffHunk[] = [];
	const staged = await git(
		['diff', '--cached', '--', path],
		cwd,
	).catch((error) => format_git_error(error));
	const unstaged = await git(['diff', '--', path], cwd).catch(
		(error) => format_git_error(error),
	);

	append_diff_section(lines, hunks, 'staged', staged);
	if (staged.trim() && unstaged.trim()) lines.push('', '');
	append_diff_section(lines, hunks, 'unstaged', unstaged);
	if (lines.length === 0)
		lines.push('No textual diff for this file.');

	return { path: file.path, lines, hunks };
}

function append_diff_section(
	lines: string[],
	hunks: DiffHunk[],
	section: DiffSection,
	raw: string,
): void {
	if (!raw.trim()) return;
	lines.push(section.toUpperCase(), '');
	const offset = lines.length;
	const parsed = parse_diff_hunks(raw, section);
	for (const hunk of parsed) {
		hunks.push({ ...hunk, line_index: offset + hunk.line_index });
	}
	lines.push(...raw.split('\n'));
}

export function parse_diff_hunks(
	raw: string,
	section: DiffSection,
): DiffHunk[] {
	const lines = raw.split('\n');
	const hunks: DiffHunk[] = [];
	let file_header: string[] = [];
	let current_hunk: { start: number; lines: string[] } | undefined;

	const flush_hunk = (): void => {
		if (!current_hunk) return;
		hunks.push({
			section,
			line_index: current_hunk.start,
			header: current_hunk.lines[0] ?? '@@',
			patch: [...file_header, ...current_hunk.lines].join('\n'),
		});
		current_hunk = undefined;
	};

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!;
		if (line.startsWith('diff --git ')) {
			flush_hunk();
			file_header = [line];
			continue;
		}
		if (line.startsWith('@@')) {
			flush_hunk();
			current_hunk = { start: index, lines: [line] };
			continue;
		}
		if (current_hunk) current_hunk.lines.push(line);
		else if (file_header.length > 0) file_header.push(line);
	}
	flush_hunk();
	return hunks;
}

export async function stage_hunk(
	cwd: string,
	hunk: DiffHunk,
): Promise<void> {
	if (hunk.section !== 'unstaged') {
		throw new Error('Selected hunk is already staged.');
	}
	await git_with_input(
		['apply', '--cached', '--whitespace=nowarn', '-'],
		cwd,
		`${hunk.patch}\n`,
	);
}

export async function unstage_hunk(
	cwd: string,
	hunk: DiffHunk,
): Promise<void> {
	if (hunk.section !== 'staged') {
		throw new Error('Selected hunk is not staged.');
	}
	await git_with_input(
		['apply', '--cached', '--reverse', '--whitespace=nowarn', '-'],
		cwd,
		`${hunk.patch}\n`,
	);
}

export function format_git_error(error: unknown): string {
	const message =
		error instanceof Error ? error.message : String(error);
	if (message.includes('No staged changes'))
		return 'No staged changes to commit.';
	if (message.includes('nothing to commit'))
		return 'Nothing to commit.';
	if (message.includes('patch does not apply')) {
		return 'Hunk no longer applies. Refresh and try again.';
	}
	if (message.includes('CONFLICT')) {
		return 'Git conflict detected. Resolve conflict markers, then stage the file.';
	}
	if (message.includes('not a git repository'))
		return 'Not inside a Git repository.';
	return message;
}

export function has_staged_changes(files: GitFile[]): boolean {
	return files.some(
		(file) => file.index_status !== ' ' && file.index_status !== '?',
	);
}

export function staged_file_count(files: GitFile[]): number {
	return files.filter(
		(file) => file.index_status !== ' ' && file.index_status !== '?',
	).length;
}
