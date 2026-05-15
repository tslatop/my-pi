import type {
	ExtensionCommandContext,
	Theme,
} from '@earendil-works/pi-coding-agent';
import {
	Key,
	matchesKey,
	truncateToWidth,
	type Component,
	type TUI,
} from '@earendil-works/pi-tui';

export interface SkillProgressUpdate {
	message?: string;
	current?: string;
	completed?: number;
	total?: number;
	line?: string;
}

export interface SkillProgressController {
	signal: AbortSignal;
	update: (update: SkillProgressUpdate) => void;
}

type ProgressResult<T> =
	| { status: 'success'; value: T }
	| { status: 'cancelled' }
	| { status: 'error'; error: unknown };

interface ProgressState {
	title: string;
	message: string;
	current?: string;
	completed?: number;
	total?: number;
	lines: string[];
	cancelled: boolean;
}

class SkillProgressOverlay implements Component {
	private frame = 0;
	private readonly frames = [
		'⠋',
		'⠙',
		'⠹',
		'⠸',
		'⠼',
		'⠴',
		'⠦',
		'⠧',
		'⠇',
		'⠏',
	];
	private readonly interval: NodeJS.Timeout;

	constructor(
		private readonly tui: TUI,
		private readonly theme: Theme,
		private readonly state: ProgressState,
		private readonly on_cancel: () => void,
	) {
		this.interval = setInterval(() => {
			this.frame = (this.frame + 1) % this.frames.length;
			this.tui.requestRender();
		}, 120);
	}

	render(width: number): string[] {
		const spinner = this.theme.fg(
			'accent',
			this.frames[this.frame] ?? '•',
		);
		const count =
			this.state.total !== undefined &&
			this.state.completed !== undefined
				? this.theme.fg(
						'dim',
						` ${this.state.completed}/${this.state.total}`,
					)
				: '';
		const lines = [
			this.theme.fg('accent', this.theme.bold(this.state.title)),
			`${spinner} ${this.state.message}${count}`,
		];

		if (this.state.current) {
			lines.push(
				this.theme.fg('muted', `Current: ${this.state.current}`),
			);
		}

		if (this.state.lines.length > 0) {
			lines.push('', this.theme.fg('dim', 'Recent activity'));
			lines.push(...this.state.lines.slice(-8));
		}

		lines.push('', this.theme.fg('dim', 'esc cancel'));
		return lines.map((line) => truncateToWidth(line, width));
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) this.on_cancel();
	}

	invalidate(): void {}

	dispose(): void {
		clearInterval(this.interval);
	}
}

export async function run_with_skill_progress<T>(
	ctx: ExtensionCommandContext,
	title: string,
	message: string,
	task: (controller: SkillProgressController) => Promise<T>,
): Promise<T | undefined> {
	const result = await ctx.ui.custom<ProgressResult<T>>(
		(tui, theme, _kb, done) => {
			const abort_controller = new AbortController();
			const state: ProgressState = {
				title,
				message,
				lines: [],
				cancelled: false,
			};

			const update = (update: SkillProgressUpdate) => {
				if (update.message !== undefined)
					state.message = update.message;
				if (update.current !== undefined)
					state.current = update.current;
				if (update.completed !== undefined)
					state.completed = update.completed;
				if (update.total !== undefined) state.total = update.total;
				if (update.line) state.lines.push(update.line);
				tui.requestRender();
			};

			const component = new SkillProgressOverlay(
				tui,
				theme,
				state,
				() => {
					if (state.cancelled) return;
					state.cancelled = true;
					state.message = 'Cancelling...';
					abort_controller.abort();
					tui.requestRender();
				},
			);

			void task({ signal: abort_controller.signal, update })
				.then((value) => {
					done(
						state.cancelled
							? { status: 'cancelled' }
							: { status: 'success', value },
					);
				})
				.catch((error: unknown) => {
					if (state.cancelled || abort_controller.signal.aborted) {
						done({ status: 'cancelled' });
						return;
					}
					done({ status: 'error', error });
				});

			return component;
		},
		{
			overlay: true,
			overlayOptions: {
				width: '70%',
				minWidth: 50,
				maxHeight: '70%',
			},
		},
	);

	if (result.status === 'cancelled') {
		ctx.ui.notify('Cancelled', 'info');
		return undefined;
	}
	if (result.status === 'error') throw result.error;
	return result.value;
}
