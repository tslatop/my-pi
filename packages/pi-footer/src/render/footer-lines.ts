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

function render_stats_line(
	model: FooterModel,
	theme: FooterTheme,
	state: FooterState,
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

	const themed_stats_left = themed_text(
		theme,
		state.tone,
		stats_left,
	);
	const remainder = stats_line.slice(stats_left.length);
	return (
		themed_stats_left + themed_text(theme, state.tone, remainder)
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
	if (sanitized.toLowerCase().startsWith(key.toLowerCase())) {
		return sanitized;
	}
	return `${key}:${sanitized}`;
}

function render_statuses(
	model: FooterModel,
	theme: FooterTheme,
	state: FooterState,
	width: number,
): string | undefined {
	const other_statuses = Array.from(model.statuses.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, text]) => render_status_label(key, text, state));
	return render_footer_status_line(
		theme,
		width,
		other_statuses,
		model.preset_status,
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

	if (state.preset === 'minimal') {
		lines.push(
			render_footer_status_line(
				theme,
				width,
				[model.pwd],
				model.model_text,
				state.tone,
			) ?? '',
		);
		return lines.filter(Boolean);
	}

	lines.push(
		truncateToWidth(
			themed_text(theme, state.tone, model.pwd),
			width,
			muted(theme, '...'),
		),
	);
	lines.push(render_stats_line(model, theme, state, width));

	const status_line = render_statuses(model, theme, state, width);
	if (status_line) lines.push(status_line);

	if (state.preset === 'power') {
		const footer_mode = themed_text(
			theme,
			state.tone,
			`footer:${state.preset}`,
		);
		lines.push(
			truncateToWidth(footer_mode, width, muted(theme, '...')),
		);
	}

	return lines;
}
