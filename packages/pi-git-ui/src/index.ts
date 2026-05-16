import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import {
	SelectList,
	Text,
	type SelectItem,
	type SelectListTheme,
} from '@earendil-works/pi-tui';
import {
	show_modal,
	type ModalBody,
	type ModalTheme,
} from '@spences10/pi-tui-modal';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec_file = promisify(execFile);

type FileState = 'staged' | 'changed' | 'mixed';

interface GitFile {
	path: string;
	index_status: string;
	worktree_status: string;
	state: FileState;
}

interface GitStatus {
	branch: string;
	files: GitFile[];
}

const EMPTY_STATUS: GitStatus = { branch: 'unknown', files: [] };

async function git(args: string[], cwd: string): Promise<string> {
	const { stdout } = await exec_file('git', args, {
		cwd,
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 8,
	});
	return stdout;
}

async function read_status(cwd: string): Promise<GitStatus> {
	const [branch, raw] = await Promise.all([
		git(['branch', '--show-current'], cwd).catch(() => 'detached'),
		git(['status', '--porcelain=v1', '-z'], cwd),
	]);

	return {
		branch: branch.trim() || 'detached',
		files: parse_porcelain_z(raw),
	};
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

		const state = get_file_state(index_status, worktree_status);

		files.push({ path, index_status, worktree_status, state });
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
	const has_index = index_status !== ' ' && index_status !== '?';
	const has_worktree =
		worktree_status !== ' ' || index_status === '?';
	if (has_index && has_worktree) return 'mixed';
	if (has_index) return 'staged';
	return 'changed';
}

function state_rank(state: FileState): number {
	if (state === 'changed') return 0;
	if (state === 'mixed') return 1;
	return 2;
}

function git_path(file: GitFile): string {
	const arrow = ' → ';
	return file.path.includes(arrow)
		? file.path.split(arrow).at(-1)!
		: file.path;
}

async function toggle_file(
	cwd: string,
	file: GitFile,
): Promise<void> {
	const path = git_path(file);
	if (file.state === 'staged') {
		await git(['restore', '--staged', '--', path], cwd);
		return;
	}
	await git(['add', '--', path], cwd);
}

async function stage_all(cwd: string): Promise<void> {
	await git(['add', '--all'], cwd);
}

async function unstage_all(cwd: string): Promise<void> {
	await git(['restore', '--staged', '--', ':/'], cwd);
}

interface GitSelectItem extends SelectItem {
	file: GitFile;
}

function make_select_theme(theme: ModalTheme): SelectListTheme {
	return {
		selectedPrefix: (text) => theme.fg('accent', text),
		selectedText: (text) => theme.fg('accent', theme.bold(text)),
		description: (text) => theme.fg('muted', text),
		scrollInfo: (text) => theme.fg('dim', text),
		noMatch: (text) => theme.fg('dim', text),
	};
}

function state_label(state: FileState): string {
	switch (state) {
		case 'staged':
			return 'staged';
		case 'mixed':
			return 'partial';
		case 'changed':
			return 'changes';
	}
}

function status_code(file: GitFile): string {
	const index = file.index_status === ' ' ? '·' : file.index_status;
	const worktree =
		file.worktree_status === ' ' ? '·' : file.worktree_status;
	return `${index}${worktree}`;
}

function to_select_item(file: GitFile, index: number): GitSelectItem {
	return {
		value: String(index),
		label: file.path,
		description: `${state_label(file.state)} • ${status_code(file)}`,
		file,
	};
}

class GitStageBody implements ModalBody {
	private selected = 0;
	private status: GitStatus = EMPTY_STATUS;
	private busy = false;
	private message = '';
	private list?: SelectList;

	constructor(
		private readonly cwd: string,
		private readonly theme: ModalTheme,
		private readonly request_render: () => void,
		private readonly done: () => void,
	) {}

	async load(): Promise<void> {
		this.busy = true;
		this.message = 'Loading git status…';
		this.request_render();
		try {
			this.status = await read_status(this.cwd);
			this.selected = Math.min(
				this.selected,
				Math.max(0, this.status.files.length - 1),
			);
			this.message =
				this.status.files.length === 0 ? 'Working tree clean' : '';
			this.rebuild_list();
		} catch (error) {
			this.status = EMPTY_STATUS;
			this.list = undefined;
			this.message =
				error instanceof Error ? error.message : String(error);
		} finally {
			this.busy = false;
			this.request_render();
		}
	}

	render(width: number): string[] {
		const lines = this.render_header(width);
		if (this.message) lines.push(...this.render_message(width));
		if (!this.list) return lines;
		return [...lines, ...this.list.render(width)];
	}

	handleInput(data: string): void {
		if (this.busy) return;
		if (data === 'q') {
			this.done();
			return;
		}
		if (data === ' ') void this.toggle_selected();
		else if (data === 'a')
			void this.run(() => stage_all(this.cwd), 'Staged all changes');
		else if (data === 'u')
			void this.run(
				() => unstage_all(this.cwd),
				'Unstaged all changes',
			);
		else if (data === 'r') void this.load();
		else this.list?.handleInput(data);
		this.request_render();
	}

	invalidate(): void {
		this.list?.invalidate();
	}

	private rebuild_list(): void {
		const items = this.status.files.map(to_select_item);
		if (items.length === 0) {
			this.list = undefined;
			return;
		}

		const list = new SelectList(
			items,
			14,
			make_select_theme(this.theme),
			{
				minPrimaryColumnWidth: 24,
			},
		);
		list.setSelectedIndex(this.selected);
		list.onSelectionChange = (item) => {
			this.selected = Number(item.value);
		};
		list.onSelect = (item) => {
			this.selected = Number(item.value);
			void this.toggle_selected();
		};
		list.onCancel = this.done;
		this.list = list;
	}

	private render_header(width: number): string[] {
		const file_count = this.status.files.length;
		const suffix = file_count === 1 ? 'file' : 'files';
		const text = `branch ${this.status.branch} • ${file_count} ${suffix}`;
		return new Text(this.theme.fg('muted', text), 0, 0).render(width);
	}

	private render_message(width: number): string[] {
		const color = this.busy ? 'accent' : 'dim';
		return new Text(this.theme.fg(color, this.message), 0, 0).render(
			width,
		);
	}

	private selected_file(): GitFile | undefined {
		const selected_item = this.list?.getSelectedItem() as
			| GitSelectItem
			| null
			| undefined;
		return selected_item?.file ?? this.status.files[this.selected];
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

	private async run(
		action: () => Promise<void>,
		success: string,
	): Promise<void> {
		this.busy = true;
		this.message = 'Working…';
		this.request_render();
		try {
			await action();
			this.message = success;
			this.status = await read_status(this.cwd);
			this.selected = Math.min(
				this.selected,
				Math.max(0, this.status.files.length - 1),
			);
			this.rebuild_list();
		} catch (error) {
			this.message =
				error instanceof Error ? error.message : String(error);
		} finally {
			this.busy = false;
			this.request_render();
		}
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
			subtitle: 'Stage and unstage files in the current repository',
			footer:
				'↑↓/jk move • space stage/unstage • a stage all • u unstage all • r refresh • esc/q close',
			overlay_options: {
				width: '82%',
				minWidth: 72,
				maxHeight: '80%',
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
