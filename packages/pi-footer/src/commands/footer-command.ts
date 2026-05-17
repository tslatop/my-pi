import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import type { SettingItem } from '@earendil-works/pi-tui';
import { show_settings_modal } from '@spences10/pi-tui-modal';
import { install_footer } from '../extension/install.js';
import {
	FOOTER_PRESETS,
	STATUS_LABEL_MODES,
	type FooterPreset,
	type FooterState,
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
		subtitle: 'Changes apply live to the footer behind this modal.',
		footer: 'enter cycles values • esc close',
		items: get_footer_settings(state),
		enable_search: true,
		detail: (item) => get_setting_detail(item.id),
		metadata: (item) => get_setting_metadata(item?.id, state),
		on_change: (id, new_value) => {
			apply_footer_setting(state, id, new_value);
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
			id: 'status-labels',
			label: 'Status labels',
			description: 'How extension statuses are labelled',
			currentValue: state.status_label_mode,
			values: [...STATUS_LABEL_MODES],
		},
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
		id === 'status-labels' &&
		STATUS_LABEL_MODES.includes(new_value as StatusLabelMode)
	) {
		state.status_label_mode = new_value as StatusLabelMode;
	}
}

function get_setting_detail(id: string): string | undefined {
	if (id === 'preset') {
		return 'Start broad here: presets choose which semantic footer rows and widgets are visible.';
	}
	if (id === 'status-labels') {
		return 'Smart avoids doubled labels such as mcp:MCP 6/6 connected while preserving context for unlabeled statuses.';
	}
}

function get_setting_metadata(
	id: string | undefined,
	state: FooterState,
): string[] {
	const lines = [
		`Current preset: ${state.preset}`,
		`Status labels: ${state.status_label_mode}`,
	];
	if (id === 'status-labels') {
		lines.push(
			'',
			'Examples:',
			'smart → MCP 6/6 connected',
			'always → mcp:MCP 6/6 connected',
			'never → MCP 6/6 connected',
		);
	}
	if (id === 'preset') {
		lines.push('', 'Research references to fold in:');
		for (const reference of FOOTER_RESEARCH_REFERENCES.slice(0, 4)) {
			lines.push(`• ${reference.name}: ${reference.takeaways[0]}`);
		}
	}
	return lines;
}
