import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { SelectList, type SettingItem } from '@earendil-works/pi-tui';
import {
	show_modal,
	show_settings_modal,
} from '@spences10/pi-tui-modal';
import { save_footer_state } from '../config.js';
import {
	get_current_footer_data,
	install_footer,
} from '../extension/install.js';
import {
	FOOTER_DENSITIES,
	FOOTER_PRESETS,
	FOOTER_TONES,
	FOOTER_WIDGETS,
	STATUS_LABEL_MODES,
	type FooterDensity,
	type FooterPreset,
	type FooterState,
	type FooterTone,
	type FooterWidget,
	type StatusLabelMode,
} from '../presets/types.js';
import { FOOTER_RESEARCH_REFERENCES } from '../reference/research.js';
import { render_footer_lines } from '../render/footer-lines.js';

export function register_footer_command(
	pi: ExtensionAPI,
	state: FooterState,
): void {
	pi.registerCommand('footer', {
		description: 'Configure the Pi footer',
		handler: async (_args, ctx) => configure_footer(ctx, state),
	});
}

async function configure_footer(
	ctx: ExtensionCommandContext,
	state: FooterState,
): Promise<void> {
	let open_widgets = false;
	await show_settings_modal(ctx, {
		title: 'Footer settings',
		subtitle:
			'Changes apply live and persist to ~/.pi/agent/extensions/pi-footer.json.',
		footer: 'space/enter cycles values • esc close',
		items: get_footer_settings(state),
		enable_search: true,
		detail: (item) => get_setting_detail(item.id),
		metadata: (item) => get_setting_metadata(item?.id, state),
		on_change: (id, new_value) => {
			if (id === 'widgets') {
				open_widgets = true;
				return true;
			}
			apply_footer_setting(state, id, new_value);
			save_footer_state(state);
			install_footer(ctx, state);
			return false;
		},
	});
	if (open_widgets) await configure_footer_widgets(ctx, state);
}

function get_footer_settings(state: FooterState): SettingItem[] {
	return [
		{
			id: 'preset',
			label: 'Preset',
			description: 'Overall footer layout',
			currentValue: state.preset,
			values: [...FOOTER_PRESETS],
		},
		{
			id: 'density',
			label: 'Density',
			description: 'How many footer rows to use',
			currentValue: state.density,
			values: [...FOOTER_DENSITIES],
		},
		{
			id: 'tone',
			label: 'Tone',
			description: 'Footer color treatment from the active Pi theme',
			currentValue: state.tone,
			values: [...FOOTER_TONES],
		},
		{
			id: 'status-labels',
			label: 'Status labels',
			description: 'How extension statuses are labelled',
			currentValue: state.status_label_mode,
			values: [...STATUS_LABEL_MODES],
		},
		{
			id: 'widgets',
			label: 'Widgets',
			description: 'Open widget visibility settings',
			currentValue: `${get_enabled_widget_count(state)}/${FOOTER_WIDGETS.length} on`,
			values: ['open'],
		},
	];
}

async function configure_footer_widgets(
	ctx: ExtensionCommandContext,
	state: FooterState,
): Promise<void> {
	await show_modal<void>(
		ctx,
		{
			title: 'Footer widgets',
			subtitle: () => get_widget_modal_subtitle(ctx, state),
			footer: 'space toggles • esc back',
		},
		({ done }, theme, layout) => {
			const items = FOOTER_WIDGETS.map((widget) => ({
				value: widget,
				label: widget,
				description: format_widget_state(state, widget),
			}));
			const list = new SelectList(
				items,
				Math.min(items.length, layout.get_max_body_lines()),
				{
					selectedPrefix: (text) => theme.fg('accent', text),
					selectedText: (text) => theme.fg('accent', text),
					description: (text) => theme.fg('muted', text),
					scrollInfo: (text) => theme.fg('dim', text),
					noMatch: (text) => theme.fg('dim', text),
				},
			);
			list.onCancel = () => done();
			return {
				render: (width: number) => list.render(width),
				invalidate: () => list.invalidate(),
				handleInput: (data: string) => {
					if (data === ' ') {
						const selected = list.getSelectedItem();
						if (!selected) return;
						const widget = selected.value as FooterWidget;
						state.widgets[widget] = !state.widgets[widget];
						selected.description = format_widget_state(state, widget);
						save_footer_state(state);
						install_footer(ctx, state);
						return;
					}
					list.handleInput(data);
				},
			};
		},
	);
}

function get_enabled_widget_count(state: FooterState): number {
	return FOOTER_WIDGETS.filter((widget) => state.widgets[widget])
		.length;
}

function get_widget_modal_subtitle(
	ctx: ExtensionCommandContext,
	state: FooterState,
): string[] {
	const footer_data = get_current_footer_data();
	if (!footer_data)
		return ['Choose footer building blocks to show or hide.'];
	const lines = render_footer_lines(
		ctx as ExtensionContext,
		ctx.ui.theme,
		footer_data,
		state,
		72,
	);
	return [
		'Choose footer building blocks to show or hide.',
		'',
		'Preview:',
		...(lines.length > 0
			? lines.map((line) => `  ${line}`)
			: ['  —']),
	];
}

function format_widget_state(
	state: FooterState,
	widget: FooterWidget,
): string {
	return state.widgets[widget] ? '● enabled' : '○ disabled';
}

function apply_footer_setting(
	state: FooterState,
	id: string,
	new_value: string,
): void {
	if (
		id === 'preset' &&
		FOOTER_PRESETS.includes(new_value as FooterPreset)
	) {
		state.preset = new_value as FooterPreset;
	}
	if (
		id === 'density' &&
		FOOTER_DENSITIES.includes(new_value as FooterDensity)
	) {
		state.density = new_value as FooterDensity;
	}
	if (
		id === 'tone' &&
		FOOTER_TONES.includes(new_value as FooterTone)
	) {
		state.tone = new_value as FooterTone;
	}
	if (
		id === 'status-labels' &&
		STATUS_LABEL_MODES.includes(new_value as StatusLabelMode)
	) {
		state.status_label_mode = new_value as StatusLabelMode;
	}
}

function get_setting_detail(id: string): string | undefined {
	if (id === 'preset')
		return 'Presets are starter arrangements; widget toggles decide exact content.';
	if (id === 'density')
		return 'Compact is one row, comfortable is normal 2–3 rows, expanded adds diagnostic/footer mode detail.';
	if (id === 'tone')
		return 'Muted uses dim theme color, balanced uses plain terminal foreground, bright uses theme accent.';
	if (id === 'status-labels')
		return 'Smart avoids doubled labels such as mcp:MCP 6/6 connected.';
	if (id === 'widgets')
		return 'Open a dedicated picker for footer building blocks.';
}

function get_setting_metadata(
	id: string | undefined,
	state: FooterState,
): string[] {
	const lines = [
		`Current preset: ${state.preset}`,
		`Density: ${state.density}`,
		`Tone: ${state.tone}`,
		`Status labels: ${state.status_label_mode}`,
	];
	if (id === 'widgets') {
		lines.push('', 'Enabled widgets:');
		for (const widget of FOOTER_WIDGETS.filter(
			(widget) => state.widgets[widget],
		)) {
			lines.push(`• ${widget}`);
		}
	}
	if (id === 'preset') {
		lines.push('', 'Research references to fold in:');
		for (const reference of FOOTER_RESEARCH_REFERENCES.slice(0, 4)) {
			lines.push(`• ${reference.name}: ${reference.takeaways[0]}`);
		}
	}
	return lines;
}
