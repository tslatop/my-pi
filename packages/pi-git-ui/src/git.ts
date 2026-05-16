import { execFile } from 'node:child_process';
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

export interface DiffView {
	path: string;
	lines: string[];
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
		};
	}

	const sections: string[] = [];
	const staged = await git(
		['diff', '--cached', '--', path],
		cwd,
	).catch((error) => format_git_error(error));
	const unstaged = await git(['diff', '--', path], cwd).catch(
		(error) => format_git_error(error),
	);

	if (staged.trim())
		sections.push('STAGED', '', ...staged.split('\n'));
	if (staged.trim() && unstaged.trim()) sections.push('', '');
	if (unstaged.trim())
		sections.push('UNSTAGED', '', ...unstaged.split('\n'));
	if (sections.length === 0)
		sections.push('No textual diff for this file.');

	return { path: file.path, lines: sections };
}

export function format_git_error(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
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
