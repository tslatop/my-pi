import type {
	ExtensionContext,
	ReadonlyFooterDataProvider,
} from '@earendil-works/pi-coding-agent';
import {
	truncateToWidth,
	visibleWidth,
} from '@earendil-works/pi-tui';
import {
	build_footer_model,
	type FooterModel,
} from '../model/footer-model.js';
import type { FooterState } from '../presets/types.js';
import {
	muted,
	themed_text,
	type FooterTheme,
} from '../theme/tokens.js';
import { sanitize_status_text } from '../utils/text.js';
import { render_footer_status_line } from './status-line.js';

function enabled_items(
	items: Array<[string, boolean | undefined]>,
): string[] {
	return items.filter(([, enabled]) => enabled).map(([text]) => text);
}

function render_stats_line(
	model: FooterModel,
	theme: FooterTheme,
	state: FooterState,
	width: number,
): string | undefined {
	const stats_left = enabled_items([
		[model.token_parts.join(' '), state.widgets.tokens],
		[
			model.cost_text ?? '',
			state.widgets.cost && Boolean(model.cost_text),
		],
		[model.context_text, state.widgets.context],
	]).join(' ');
	const right_parts = enabled_items([
		[model.model_name, state.widgets.model],
		[
			model.thinking_text ?? '',
			state.widgets.thinking && Boolean(model.thinking_text),
		],
	]);
	const right_side = right_parts.join(' • ');
	if (!stats_left && !right_side) return undefined;

	let left = stats_left;
	let left_width = visibleWidth(left);
	if (left_width > width) {
		left = truncateToWidth(left, width, '...');
		left_width = visibleWidth(left);
	}
	if (!right_side) return themed_text(theme, state.tone, left);
	if (!left) {
		return truncateToWidth(
			themed_text(theme, state.tone, right_side),
			width,
			muted(theme, '...'),
		);
	}

	const right_width = visibleWidth(right_side);
	const available_for_right = Math.max(0, width - left_width - 2);
	const rendered_right =
		left_width + 2 + right_width <= width
			? right_side
			: truncateToWidth(right_side, available_for_right, '');
	const gap = Math.max(
		1,
		width - left_width - visibleWidth(rendered_right),
	);
	return (
		themed_text(theme, state.tone, left) +
		' '.repeat(gap) +
		themed_text(theme, state.tone, rendered_right)
	);
}

function render_status_label(
	key: string,
	text: string,
	state: FooterState,
): string {
	const sanitized = sanitize_status_text(text);
	if (state.status_label_mode === 'never') return sanitized;
	if (state.status_label_mode === 'always')
		return `${key}:${sanitized}`;
	if (sanitized.toLowerCase().startsWith(key.toLowerCase()))
		return sanitized;
	return `${key}:${sanitized}`;
}

function prioritized_statuses(
	statuses: Map<string, string>,
): Array<[string, string]> {
	const priority = ['mcp', 'team', 'lsp', 'recall', 'nopeek'];
	return Array.from(statuses.entries()).sort(([a], [b]) => {
		const a_index = priority.indexOf(a);
		const b_index = priority.indexOf(b);
		if (a_index !== -1 || b_index !== -1) {
			return (
				(a_index === -1 ? 99 : a_index) -
				(b_index === -1 ? 99 : b_index)
			);
		}
		return a.localeCompare(b);
	});
}

function render_statuses(
	model: FooterModel,
	theme: FooterTheme,
	state: FooterState,
	width: number,
): string | undefined {
	if (!state.widgets.statuses && !state.widgets.preset)
		return undefined;
	const other_statuses = state.widgets.statuses
		? prioritized_statuses(model.statuses).map(([key, text]) =>
				render_status_label(key, text, state),
			)
		: [];
	return render_footer_status_line(
		theme,
		width,
		other_statuses,
		state.widgets.preset ? model.preset_status : undefined,
		state.tone,
	);
}

function render_path_line(
	model: FooterModel,
	theme: FooterTheme,
	state: FooterState,
	width: number,
): string | undefined {
	const left = enabled_items([
		[model.path_text, state.widgets.path],
		[
			model.git_text ? `(${model.git_text})` : '',
			state.widgets.git && Boolean(model.git_text),
		],
	]);
	const right = state.widgets.session
		? model.session_text
		: undefined;
	return render_footer_status_line(
		theme,
		width,
		left,
		right,
		state.tone,
	);
}

export function render_footer_lines(
	ctx: ExtensionContext,
	theme: FooterTheme,
	footer_data: ReadonlyFooterDataProvider,
	state: FooterState,
	width: number,
): string[] {
	const model = build_footer_model(ctx, footer_data, theme);
	const lines: string[] = [];
	const path_line = render_path_line(model, theme, state, width);
	const stats_line = render_stats_line(model, theme, state, width);
	const status_line = render_statuses(model, theme, state, width);

	if (state.density === 'compact' || state.preset === 'minimal') {
		const compact_left = [path_line, stats_line]
			.filter(Boolean)
			.join(' ');
		const compact = render_footer_status_line(
			theme,
			width,
			[compact_left],
			status_line,
			state.tone,
		);
		return compact ? [compact] : [];
	}

	if (path_line)
		lines.push(
			truncateToWidth(path_line, width, muted(theme, '...')),
		);
	if (stats_line)
		lines.push(
			truncateToWidth(stats_line, width, muted(theme, '...')),
		);
	if (status_line) lines.push(status_line);

	if (state.density === 'expanded' || state.preset === 'power') {
		const footer_mode = themed_text(
			theme,
			state.tone,
			`footer:${state.preset} density:${state.density}`,
		);
		lines.push(
			truncateToWidth(footer_mode, width, muted(theme, '...')),
		);
	}

	return lines;
}
