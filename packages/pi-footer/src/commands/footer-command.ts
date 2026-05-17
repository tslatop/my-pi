import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import type { SettingItem } from '@earendil-works/pi-tui';
import { show_settings_modal } from '@spences10/pi-tui-modal';
import { save_footer_state } from '../config.js';
import { install_footer } from '../extension/install.js';
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
	await show_settings_modal(ctx, {
		title: 'Footer settings',
		subtitle:
			'Changes apply live and persist to ~/.pi/agent/extensions/pi-footer.json.',
		footer: 'enter cycles values • esc close',
		items: get_footer_settings(state),
		enable_search: true,
		detail: (item) => get_setting_detail(item.id),
		metadata: (item) => get_setting_metadata(item?.id, state),
		on_change: (id, new_value) => {
			apply_footer_setting(state, id, new_value);
			save_footer_state(state);
			install_footer(ctx, state);
			return false;
		},
	});
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
		...FOOTER_WIDGETS.map((widget) => ({
			id: `widget:${widget}`,
			label: `Widget: ${widget}`,
			description: 'Show or hide this footer building block',
			currentValue: state.widgets[widget] ? 'on' : 'off',
			values: ['on', 'off'],
		})),
	];
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
	if (id.startsWith('widget:')) {
		const widget = id.slice('widget:'.length) as FooterWidget;
		if (FOOTER_WIDGETS.includes(widget))
			state.widgets[widget] = new_value === 'on';
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
	if (id.startsWith('widget:'))
		return 'Widgets are composable footer building blocks you can show or hide.';
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
	if (id?.startsWith('widget:')) {
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
