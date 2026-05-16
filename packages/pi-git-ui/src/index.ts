import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import {
	show_modal,
	type ModalBody,
	type ModalTheme,
} from '@spences10/pi-tui-modal';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec_file = promisify(execFile);

type FileState =
	| 'staged'
	| 'changed'
	| 'mixed'
	| 'untracked'
	| 'conflicted';

interface GitFile {
	path: string;
	index_status: string;
	worktree_status: string;
	state: FileState;
}

interface GitStatus {
	branch: string;
	upstream?: string;
	ahead: number;
	behind: number;
	files: GitFile[];
}

interface DiffView {
	path: string;
	lines: string[];
}

const EMPTY_STATUS: GitStatus = {
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

async function read_status(cwd: string): Promise<GitStatus> {
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

function parse_porcelain_z(raw: string): GitFile[] {
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

async function stage_file(cwd: string, file: GitFile): Promise<void> {
	await git(['add', '--', git_path(file)], cwd);
}

async function unstage_file(
	cwd: string,
	file: GitFile,
): Promise<void> {
	await git(['restore', '--staged', '--', git_path(file)], cwd);
}

async function toggle_file(
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

async function stage_all(cwd: string): Promise<void> {
	await git(['add', '--all'], cwd);
}

async function unstage_all(cwd: string): Promise<void> {
	await git(['restore', '--staged', '--', ':/'], cwd);
}

async function read_diff(
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

function format_git_error(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function state_label(state: FileState): string {
	switch (state) {
		case 'staged':
			return 'staged';
		case 'mixed':
			return 'partial';
		case 'untracked':
			return 'untracked';
		case 'conflicted':
			return 'conflict';
		case 'changed':
			return 'changed';
	}
}

function status_code(file: GitFile): string {
	const index = file.index_status === ' ' ? '·' : file.index_status;
	const worktree =
		file.worktree_status === ' ' ? '·' : file.worktree_status;
	return `${index}${worktree}`;
}

function state_counts(files: GitFile[]): string {
	const counts = new Map<FileState, number>();
	for (const file of files)
		counts.set(file.state, (counts.get(file.state) ?? 0) + 1);
	return (
		['conflicted', 'changed', 'untracked', 'mixed', 'staged'] as const
	)
		.filter((state) => counts.has(state))
		.map((state) => `${state_label(state)} ${counts.get(state)}`)
		.join(' • ');
}

function key_is_up(data: string): boolean {
	return data === 'k' || data === '\x1B[A';
}

function key_is_down(data: string): boolean {
	return data === 'j' || data === '\x1B[B';
}

function strip_ansi(text: string): string {
	const escape = String.fromCharCode(27);
	let output = '';
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== escape) {
			output += text[i];
			continue;
		}
		if (text[i + 1] !== '[') continue;
		i += 2;
		while (i < text.length && !is_ansi_final_byte(text.charCodeAt(i)))
			i++;
	}
	return output;
}

function is_ansi_final_byte(code: number): boolean {
	return code >= 0x40 && code <= 0x7e;
}

function truncate_plain(text: string, width: number): string {
	if (width <= 0) return '';
	if (text.length <= width) return text;
	return `${text.slice(0, Math.max(0, width - 1))}…`;
}

function pad_plain(text: string, width: number): string {
	return text + ' '.repeat(Math.max(0, width - text.length));
}

function pad_ansi(text: string, width: number): string {
	return (
		text + ' '.repeat(Math.max(0, width - strip_ansi(text).length))
	);
}

class GitStageBody implements ModalBody {
	private selected = 0;
	private diff_scroll = 0;
	private status: GitStatus = EMPTY_STATUS;
	private diff?: DiffView;
	private diff_for_path = '';
	private busy = false;
	private message = '';

	constructor(
		private readonly cwd: string,
		private readonly theme: ModalTheme,
		private readonly request_render: () => void,
		private readonly done: () => void,
	) {}

	async load(preferred_path?: string): Promise<void> {
		this.busy = true;
		this.message = 'Loading git status…';
		this.request_render();
		try {
			this.status = await read_status(this.cwd);
			this.restore_selection(preferred_path);
			this.message =
				this.status.files.length === 0 ? 'Working tree clean' : '';
			await this.load_diff();
		} catch (error) {
			this.status = EMPTY_STATUS;
			this.diff = undefined;
			this.message = format_git_error(error);
		} finally {
			this.busy = false;
			this.request_render();
		}
	}

	render(width: number): string[] {
		const lines = this.render_header(width);
		if (this.message) lines.push(...this.render_message(width));
		if (this.status.files.length === 0) return lines;
		return [...lines, ...this.render_workbench(width)];
	}

	handleInput(data: string): void {
		if (this.busy) return;
		if (data === 'q' || data === '\x1B') {
			this.done();
			return;
		}
		if (key_is_up(data)) this.move_selection(-1);
		else if (key_is_down(data)) this.move_selection(1);
		else if (data === '\x1B[C' || data === 'l') this.scroll_diff(4);
		else if (data === '\x1B[D' || data === 'h') this.scroll_diff(-4);
		else if (data === ' ') void this.toggle_selected();
		else if (data === 's') void this.stage_selected();
		else if (data === 'x') void this.unstage_selected();
		else if (data === 'a') void this.stage_all_safely();
		else if (data === 'A')
			void this.run(
				() => stage_all(this.cwd),
				'Force-staged all changes',
			);
		else if (data === 'u')
			void this.run(
				() => unstage_all(this.cwd),
				'Unstaged all changes',
			);
		else if (data === 'r') void this.load(this.selected_file()?.path);
		this.request_render();
	}

	invalidate(): void {}

	private restore_selection(preferred_path?: string): void {
		const path =
			preferred_path ?? this.status.files[this.selected]?.path;
		const index = path
			? this.status.files.findIndex((file) => file.path === path)
			: -1;
		this.selected =
			index >= 0
				? index
				: Math.min(
						this.selected,
						Math.max(0, this.status.files.length - 1),
					);
	}

	private render_header(width: number): string[] {
		const upstream = this.status.upstream
			? ` • ${this.status.upstream} ↑${this.status.ahead} ↓${this.status.behind}`
			: '';
		const counts = state_counts(this.status.files);
		const text = `branch ${this.status.branch}${upstream} • ${this.status.files.length} files${counts ? ` • ${counts}` : ''}`;
		return new Text(this.theme.fg('muted', text), 0, 0).render(width);
	}

	private render_message(width: number): string[] {
		const color = this.busy
			? 'accent'
			: this.message.includes('disabled') ||
				  this.message.includes('conflict') ||
				  this.message.includes('blocked')
				? 'warning'
				: 'dim';
		return new Text(this.theme.fg(color, this.message), 0, 0).render(
			width,
		);
	}

	private render_workbench(width: number): string[] {
		const gap = width >= 96 ? 3 : 1;
		const list_width = Math.min(
			42,
			Math.max(28, Math.floor(width * 0.42)),
		);
		const diff_width = Math.max(20, width - list_width - gap);
		const list = this.render_file_list(list_width);
		const diff = this.render_diff(diff_width, list.length);
		const height = Math.max(list.length, diff.length);
		const lines: string[] = [];
		for (let i = 0; i < height; i++) {
			const left = pad_ansi(list[i] ?? '', list_width);
			lines.push(`${left}${' '.repeat(gap)}${diff[i] ?? ''}`);
		}
		return lines;
	}

	private render_file_list(width: number): string[] {
		const lines = [this.theme.bold('Files')];
		let last_state: FileState | undefined;
		for (let i = 0; i < this.status.files.length; i++) {
			const file = this.status.files[i]!;
			if (file.state !== last_state) {
				lines.push(
					this.theme.fg('dim', state_label(file.state).toUpperCase()),
				);
				last_state = file.state;
			}
			const selected = i === this.selected;
			const prefix = selected ? '› ' : '  ';
			const label_width = Math.max(8, width - 14);
			const label = truncate_plain(file.path, label_width);
			const meta = `${state_icon(file.state)} ${status_code(file)}`;
			const line = `${prefix}${pad_plain(label, label_width)} ${meta}`;
			lines.push(
				selected
					? this.theme.fg('accent', this.theme.bold(line))
					: line,
			);
		}
		return lines;
	}

	private render_diff(width: number, height: number): string[] {
		const selected = this.selected_file();
		const title = selected
			? `Diff: ${truncate_plain(selected.path, Math.max(0, width - 6))}`
			: 'Diff';
		const lines = [this.theme.bold(title)];
		if (!this.diff || this.diff.path !== this.diff_for_path) {
			lines.push(this.theme.fg('dim', 'Loading diff…'));
			return lines;
		}

		const visible = Math.max(1, height - 1);
		const max_scroll = Math.max(0, this.diff.lines.length - visible);
		this.diff_scroll = Math.min(this.diff_scroll, max_scroll);
		const body = this.diff.lines.slice(
			this.diff_scroll,
			this.diff_scroll + visible,
		);
		for (const raw of body)
			lines.push(this.format_diff_line(raw, width));
		if (max_scroll > 0) {
			lines[0] = `${lines[0]} ${this.theme.fg('dim', `${this.diff_scroll + 1}-${Math.min(this.diff_scroll + visible, this.diff.lines.length)}/${this.diff.lines.length}`)}`;
		}
		return lines;
	}

	private format_diff_line(raw: string, width: number): string {
		const text = truncate_plain(raw.replace(/\t/g, '  '), width);
		if (raw === 'STAGED' || raw === 'UNSTAGED')
			return this.theme.fg('accent', this.theme.bold(text));
		if (raw.startsWith('+++') || raw.startsWith('---'))
			return this.theme.fg('muted', text);
		if (raw.startsWith('@@')) return this.theme.fg('accent', text);
		if (raw.startsWith('+')) return this.theme.fg('success', text);
		if (raw.startsWith('-')) return this.theme.fg('warning', text);
		return text;
	}

	private selected_file(): GitFile | undefined {
		return this.status.files[this.selected];
	}

	private move_selection(delta: number): void {
		const next = Math.max(
			0,
			Math.min(this.status.files.length - 1, this.selected + delta),
		);
		if (next === this.selected) return;
		this.selected = next;
		this.diff_scroll = 0;
		void this.load_diff();
	}

	private scroll_diff(delta: number): void {
		this.diff_scroll = Math.max(0, this.diff_scroll + delta);
	}

	private async load_diff(): Promise<void> {
		const file = this.selected_file();
		if (!file) {
			this.diff = undefined;
			return;
		}
		const path = file.path;
		this.diff_for_path = path;
		try {
			this.diff = await read_diff(this.cwd, file);
		} catch (error) {
			this.diff = { path, lines: [format_git_error(error)] };
		}
		this.request_render();
	}

	private async toggle_selected(): Promise<void> {
		const file = this.selected_file();
		if (!file) return;
		const verb = file.state === 'staged' ? 'Unstaged' : 'Staged';
		await this.run(
			() => toggle_file(this.cwd, file),
			`${verb} ${file.path}`,
		);
	}

	private async stage_selected(): Promise<void> {
		const file = this.selected_file();
		if (!file) return;
		await this.run(
			() => stage_file(this.cwd, file),
			`Staged ${file.path}`,
		);
	}

	private async stage_all_safely(): Promise<void> {
		const unsafe = this.status.files.find(
			(file) => file.state === 'mixed' || file.state === 'conflicted',
		);
		if (unsafe) {
			this.message = `Stage all blocked by ${state_label(unsafe.state)} file ${unsafe.path}. Use A to force.`;
			return;
		}
		await this.run(() => stage_all(this.cwd), 'Staged all changes');
	}

	private async unstage_selected(): Promise<void> {
		const file = this.selected_file();
		if (!file) return;
		await this.run(
			() => unstage_file(this.cwd, file),
			`Unstaged ${file.path}`,
		);
	}

	private async run(
		action: () => Promise<void>,
		success: string,
	): Promise<void> {
		const path = this.selected_file()?.path;
		this.busy = true;
		this.message = 'Working…';
		this.request_render();
		try {
			await action();
			this.message = success;
			this.status = await read_status(this.cwd);
			this.restore_selection(path);
			this.diff_scroll = 0;
			await this.load_diff();
		} catch (error) {
			this.message = format_git_error(error);
		} finally {
			this.busy = false;
			this.request_render();
		}
	}
}

function state_icon(state: FileState): string {
	switch (state) {
		case 'conflicted':
			return '!';
		case 'changed':
			return '±';
		case 'untracked':
			return '?';
		case 'mixed':
			return '◐';
		case 'staged':
			return '✓';
	}
}

async function show_git_ui(
	ctx: ExtensionCommandContext,
): Promise<void> {
	if (!ctx.hasUI || typeof ctx.ui.custom !== 'function') {
		ctx.ui.notify('Git UI requires interactive mode.', 'warning');
		return;
	}

	await show_modal<void>(
		ctx,
		{
			title: 'Source Control',
			subtitle:
				'Review diffs and safely stage or unstage files in the current repository',
			footer:
				'↑↓/jk move • ←→/hl scroll diff • space safe toggle • s stage • x unstage • a safe stage all • A force stage all • u unstage all • r refresh • esc/q close',
			overlay_options: {
				width: '92%',
				minWidth: 80,
				maxHeight: '88%',
			},
			style: { border: 'rounded', border_color: 'accent' },
		},
		({ done }, theme, _layout, tui) => {
			const body = new GitStageBody(
				ctx.cwd,
				theme,
				() => tui.requestRender(),
				done,
			);
			void body.load();
			return body;
		},
	);
}

export default function git_ui_extension(pi: ExtensionAPI): void {
	pi.registerCommand('git-ui', {
		description: 'Open an interactive Git staging UI',
		handler: async (_args, ctx) => {
			await show_git_ui(ctx);
		},
	});
}
