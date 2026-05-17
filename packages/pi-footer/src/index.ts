import {
	clampThinkingLevel,
	getSupportedThinkingLevels,
	type ModelThinkingLevel,
} from '@earendil-works/pi-ai';
import type {
	ExtensionAPI,
	ExtensionContext,
	ReadonlyFooterDataProvider,
} from '@earendil-works/pi-coding-agent';
import {
	truncateToWidth,
	visibleWidth,
} from '@earendil-works/pi-tui';
import { show_picker_modal } from '@spences10/pi-tui-modal';

const PRESETS = ['minimal', 'default', 'power', 'git-heavy'] as const;
type FooterPreset = (typeof PRESETS)[number];

interface FooterState {
	preset: FooterPreset;
}

const state: FooterState = {
	preset: 'default',
};

function sanitize_status_text(text: string): string {
	return text
		.replace(/[\r\n\t]/g, ' ')
		.replace(/ +/g, ' ')
		.trim();
}

function format_token_count(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

export function render_footer_status_line(
	theme: ExtensionContext['ui']['theme'],
	width: number,
	left_items: string[],
	right_item?: string,
): string | undefined {
	const left = sanitize_status_text(left_items.join(' '));
	const right = right_item ? sanitize_status_text(right_item) : '';
	if (!left && !right) return undefined;
	if (!right) {
		return truncateToWidth(
			theme.fg('dim', left),
			width,
			theme.fg('dim', '...'),
		);
	}
	if (!left) {
		const themed_right = theme.fg('dim', right);
		const right_width = visibleWidth(themed_right);
		return right_width >= width
			? truncateToWidth(themed_right, width, theme.fg('dim', '...'))
			: `${' '.repeat(width - right_width)}${themed_right}`;
	}

	const right_width = visibleWidth(right);
	if (right_width >= width) {
		return truncateToWidth(
			theme.fg('dim', right),
			width,
			theme.fg('dim', '...'),
		);
	}

	const min_gap = 1;
	const available_left = Math.max(0, width - right_width - min_gap);
	const truncated_left = truncateToWidth(left, available_left, '...');
	const left_width = visibleWidth(truncated_left);
	const gap = Math.max(min_gap, width - left_width - right_width);
	return (
		theme.fg('dim', truncated_left) +
		' '.repeat(gap) +
		theme.fg('dim', right)
	);
}

const VALID_THINKING_LEVELS = new Set<ModelThinkingLevel>([
	'off',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
]);

function is_model_thinking_level(
	level: string,
): level is ModelThinkingLevel {
	return VALID_THINKING_LEVELS.has(level as ModelThinkingLevel);
}

export function get_default_footer_thinking_level(
	model: ExtensionContext['model'],
): ModelThinkingLevel {
	if (!model?.reasoning) return 'off';
	return clampThinkingLevel(model, 'medium');
}

export function get_current_thinking_level(
	ctx: Pick<ExtensionContext, 'model' | 'sessionManager'>,
): ModelThinkingLevel {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as {
			type?: string;
			thinkingLevel?: string;
		};
		if (
			entry.type === 'thinking_level_change' &&
			typeof entry.thinkingLevel === 'string' &&
			is_model_thinking_level(entry.thinkingLevel)
		) {
			if (!ctx.model?.reasoning) return 'off';
			return getSupportedThinkingLevels(ctx.model).includes(
				entry.thinkingLevel,
			)
				? entry.thinkingLevel
				: clampThinkingLevel(ctx.model, entry.thinkingLevel);
		}
	}
	return get_default_footer_thinking_level(ctx.model);
}

interface FooterModel {
	pwd: string;
	stats_parts: string[];
	model_text: string;
	statuses: Map<string, string>;
	preset_status?: string;
}

function build_footer_model(
	ctx: ExtensionContext,
	footer_data: ReadonlyFooterDataProvider,
	theme: ExtensionContext['ui']['theme'],
): FooterModel {
	let total_input = 0;
	let total_output = 0;
	let total_cache_read = 0;
	let total_cache_write = 0;
	let total_cost = 0;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (
			entry.type === 'message' &&
			entry.message.role === 'assistant'
		) {
			total_input += entry.message.usage.input;
			total_output += entry.message.usage.output;
			total_cache_read += entry.message.usage.cacheRead;
			total_cache_write += entry.message.usage.cacheWrite;
			total_cost += entry.message.usage.cost.total;
		}
	}

	const context_usage = ctx.getContextUsage();
	const context_window =
		context_usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	const context_percent_value = context_usage?.percent ?? 0;
	const context_percent =
		context_usage?.percent !== null
			? context_percent_value.toFixed(1)
			: '?';

	let pwd = ctx.cwd;
	const home = process.env.HOME || process.env.USERPROFILE;
	if (home && pwd.startsWith(home)) {
		pwd = `~${pwd.slice(home.length)}`;
	}

	const branch = footer_data.getGitBranch();
	if (branch) {
		pwd = `${pwd} (${branch})`;
	}

	const session_name = ctx.sessionManager.getSessionName();
	if (session_name) {
		pwd = `${pwd} • ${session_name}`;
	}

	const stats_parts: string[] = [];
	if (total_input)
		stats_parts.push(`↑${format_token_count(total_input)}`);
	if (total_output)
		stats_parts.push(`↓${format_token_count(total_output)}`);
	if (total_cache_read)
		stats_parts.push(`R${format_token_count(total_cache_read)}`);
	if (total_cache_write)
		stats_parts.push(`W${format_token_count(total_cache_write)}`);

	const using_subscription = ctx.model
		? ctx.modelRegistry.isUsingOAuth(ctx.model)
		: false;
	if (total_cost || using_subscription) {
		stats_parts.push(
			`$${total_cost.toFixed(3)}${using_subscription ? ' (sub)' : ''}`,
		);
	}

	const context_percent_display =
		context_percent === '?'
			? `?/${format_token_count(context_window)}`
			: `${context_percent}%/${format_token_count(context_window)}`;
	let context_percent_str = context_percent_display;
	if (context_percent_value > 90) {
		context_percent_str = theme.fg('error', context_percent_display);
	} else if (context_percent_value > 70) {
		context_percent_str = theme.fg(
			'warning',
			context_percent_display,
		);
	}
	stats_parts.push(context_percent_str);

	const model_name = ctx.model?.id || 'no-model';
	const thinking_level = get_current_thinking_level(ctx);
	let model_text = model_name;
	if (ctx.model?.reasoning) {
		model_text =
			thinking_level === 'off'
				? `${model_name} • thinking off`
				: `${model_name} • ${thinking_level}`;
	}
	if (footer_data.getAvailableProviderCount() > 1 && ctx.model) {
		model_text = `(${ctx.model.provider}) ${model_text}`;
	}

	const statuses = new Map(footer_data.getExtensionStatuses());
	const preset_status = statuses.get('preset');
	statuses.delete('preset');

	return {
		pwd,
		stats_parts,
		model_text,
		statuses,
		preset_status,
	};
}

function render_stats_line(
	model: FooterModel,
	theme: ExtensionContext['ui']['theme'],
	width: number,
): string {
	let stats_left = model.stats_parts.join(' ');
	let stats_left_width = visibleWidth(stats_left);
	if (stats_left_width > width) {
		stats_left = truncateToWidth(stats_left, width, '...');
		stats_left_width = visibleWidth(stats_left);
	}

	let right_side = model.model_text;
	if (stats_left_width + 2 + visibleWidth(right_side) > width) {
		right_side = right_side.replace(/^\([^)]*\) /, '');
	}

	const right_side_width = visibleWidth(right_side);
	const total_needed = stats_left_width + 2 + right_side_width;
	let stats_line: string;
	if (total_needed <= width) {
		const padding = ' '.repeat(
			width - stats_left_width - right_side_width,
		);
		stats_line = stats_left + padding + right_side;
	} else {
		const available_for_right = width - stats_left_width - 2;
		if (available_for_right > 0) {
			const truncated_right = truncateToWidth(
				right_side,
				available_for_right,
				'',
			);
			const truncated_right_width = visibleWidth(truncated_right);
			const padding = ' '.repeat(
				Math.max(0, width - stats_left_width - truncated_right_width),
			);
			stats_line = stats_left + padding + truncated_right;
		} else {
			stats_line = stats_left;
		}
	}

	const dim_stats_left = theme.fg('dim', stats_left);
	const remainder = stats_line.slice(stats_left.length);
	return dim_stats_left + theme.fg('dim', remainder);
}

function render_statuses(
	model: FooterModel,
	theme: ExtensionContext['ui']['theme'],
	width: number,
): string | undefined {
	const other_statuses = Array.from(model.statuses.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, text]) => `${key}:${sanitize_status_text(text)}`);
	return render_footer_status_line(
		theme,
		width,
		other_statuses,
		model.preset_status,
	);
}

function render_footer_lines(
	ctx: ExtensionContext,
	theme: ExtensionContext['ui']['theme'],
	footer_data: ReadonlyFooterDataProvider,
	width: number,
): string[] {
	const model = build_footer_model(ctx, footer_data, theme);
	const lines: string[] = [];

	if (state.preset === 'minimal') {
		lines.push(
			render_footer_status_line(
				theme,
				width,
				[model.pwd],
				model.model_text,
			) ?? '',
		);
		return lines.filter(Boolean);
	}

	lines.push(
		truncateToWidth(
			theme.fg('dim', model.pwd),
			width,
			theme.fg('dim', '...'),
		),
	);
	lines.push(render_stats_line(model, theme, width));

	const status_line = render_statuses(model, theme, width);
	if (status_line) lines.push(status_line);

	if (state.preset === 'power') {
		const footer_mode = theme.fg('dim', `footer:${state.preset}`);
		lines.push(
			truncateToWidth(footer_mode, width, theme.fg('dim', '...')),
		);
	}

	return lines;
}

function install_footer(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setFooter((tui, theme, footer_data) => {
		const unsubscribe = footer_data.onBranchChange(() =>
			tui.requestRender(),
		);
		return {
			dispose: unsubscribe,
			invalidate() {},
			render(width: number) {
				return render_footer_lines(ctx, theme, footer_data, width);
			},
		};
	});
}

export default function footer_extension(pi: ExtensionAPI): void {
	pi.registerCommand('footer', {
		description: 'Configure the Pi footer',
		handler: async (_args, ctx) => {
			const selected = await show_picker_modal(ctx, {
				title: 'Footer preset',
				items: PRESETS.map((preset) => ({
					value: preset,
					label: preset,
					description:
						preset === state.preset
							? 'Current footer preset'
							: undefined,
				})),
				initial_index: PRESETS.indexOf(state.preset),
			});
			if (!selected) return;
			if (PRESETS.includes(selected as FooterPreset)) {
				state.preset = selected as FooterPreset;
				install_footer(ctx);
				ctx.ui.notify(`Footer preset: ${state.preset}`, 'info');
			}
		},
	});

	pi.on('session_start', async (_event, ctx) => {
		install_footer(ctx);
	});

	pi.on('session_shutdown', async (_event, ctx) => {
		ctx.ui.setFooter(undefined);
	});
}
