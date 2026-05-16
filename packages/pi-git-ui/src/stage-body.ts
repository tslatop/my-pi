import { Text, type Focusable } from '@earendil-works/pi-tui';
import type { ModalBody, ModalTheme } from '@spences10/pi-tui-modal';
import { CommitComposer } from './commit-composer.js';
import {
	commit,
	EMPTY_STATUS,
	format_git_error,
	has_staged_changes,
	read_diff,
	read_status,
	stage_all,
	stage_file,
	staged_file_count,
	toggle_file,
	unstage_all,
	unstage_file,
	type DiffView,
	type FileState,
	type GitFile,
	type GitStatus,
} from './git.js';
import {
	key_is_down,
	key_is_up,
	pad_ansi,
	pad_plain,
	state_counts,
	state_icon,
	state_label,
	status_code,
	truncate_plain,
} from './render.js';

export class GitStageBody implements ModalBody, Focusable {
	private selected = 0;
	private diff_scroll = 0;
	private status: GitStatus = EMPTY_STATUS;
	private diff?: DiffView;
	private diff_for_path = '';
	private busy = false;
	private message = '';
	private composer?: CommitComposer;
	private _focused = false;

	constructor(
		private readonly cwd: string,
		private readonly theme: ModalTheme,
		private readonly request_render: () => void,
		private readonly done: () => void,
	) {}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		if (this.composer) this.composer.focused = value;
	}

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
		if (this.composer) return this.composer.render(width);
		const lines = this.render_header(width);
		if (this.message) lines.push(...this.render_message(width));
		if (this.status.files.length === 0) return lines;
		return [...lines, ...this.render_workbench(width)];
	}

	handleInput(data: string): void {
		if (this.composer) {
			this.composer.handleInput(data);
			this.request_render();
			return;
		}
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
		else if (data === 'c') this.open_commit_composer();
		else if (data === 'r') void this.load(this.selected_file()?.path);
		this.request_render();
	}

	invalidate(): void {
		this.composer?.invalidate();
	}

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
		const staged = staged_file_count(this.status.files);
		const text = `branch ${this.status.branch}${upstream} • ${this.status.files.length} files • staged ${staged}${counts ? ` • ${counts}` : ''}`;
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

	private open_commit_composer(): void {
		if (!has_staged_changes(this.status.files)) {
			this.message = 'No staged changes to commit.';
			return;
		}
		this.composer = new CommitComposer(
			this.theme,
			staged_file_count(this.status.files),
			(message) => void this.commit_staged(message),
			() => {
				this.composer = undefined;
			},
		);
		this.composer.focused = this.focused;
	}

	private async commit_staged(message: string): Promise<void> {
		this.composer = undefined;
		await this.run(
			() => commit(this.cwd, message),
			`Committed ${message}`,
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
