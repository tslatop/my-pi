import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { SettingItem } from '@earendil-works/pi-tui';
import { show_settings_modal } from '@spences10/pi-tui-modal';
import {
	get_prompt_source_label,
	list_base_presets,
	list_layer_presets,
} from './catalog.js';
import {
	DISABLED,
	ENABLED,
	NONE_BASE_ID,
	SELECTED,
	sets_equal,
	UNSELECTED,
} from './state.js';
import type { LoadedPromptPreset } from './types.js';

export interface PromptPresetManagerState {
	presets: Record<string, LoadedPromptPreset>;
	active_base_name: string | undefined;
	active_layers: ReadonlySet<string>;
}

export async function show_prompt_preset_manager(
	ctx: ExtensionCommandContext,
	state: PromptPresetManagerState,
	on_change: (
		base_name: string | undefined,
		layers: ReadonlySet<string>,
	) => void,
): Promise<void> {
	const base_presets = list_base_presets(state.presets);
	const layer_presets = list_layer_presets(state.presets);
	if (base_presets.length === 0 && layer_presets.length === 0) {
		ctx.ui.notify('No prompt presets available', 'warning');
		return;
	}

	const initial_base = state.active_base_name;
	const initial_layers = new Set(state.active_layers);
	let selected_base = state.active_base_name;
	const enabled_layers = new Set(state.active_layers);

	const items: SettingItem[] = [];
	const base_ids = new Set<string>();
	const layer_ids = new Set<string>();

	items.push({
		id: '__header_base__',
		label: `── Base presets (${base_presets.length + 1}) ──`,
		description: '',
		currentValue: '',
	});
	items.push({
		id: NONE_BASE_ID,
		label: '(none)',
		description: 'No active base preset',
		currentValue: UNSELECTED,
		values: [SELECTED, UNSELECTED],
	});
	base_ids.add(NONE_BASE_ID);

	for (const preset of base_presets) {
		items.push({
			id: preset.name,
			label: preset.name,
			description: [
				`${get_prompt_source_label(preset.source)} • ${preset.description ?? 'base preset'}`,
			].join('\n'),
			currentValue: UNSELECTED,
			values: [SELECTED, UNSELECTED],
		});
		base_ids.add(preset.name);
	}

	items.push({
		id: '__header_layers__',
		label: `── Prompt layers (${layer_presets.length}) ──`,
		description: '',
		currentValue: '',
	});
	for (const preset of layer_presets) {
		items.push({
			id: preset.name,
			label: preset.name,
			description: [
				`${get_prompt_source_label(preset.source)} • ${preset.description ?? 'layer'}`,
			].join('\n'),
			currentValue: DISABLED,
			values: [ENABLED, DISABLED],
		});
		layer_ids.add(preset.name);
	}

	function sync_values() {
		for (const item of items) {
			if (base_ids.has(item.id)) {
				const is_selected =
					(item.id === NONE_BASE_ID && !selected_base) ||
					item.id === selected_base;
				item.currentValue = is_selected ? SELECTED : UNSELECTED;
			} else if (layer_ids.has(item.id)) {
				item.currentValue = enabled_layers.has(item.id)
					? ENABLED
					: DISABLED;
			}
		}
	}

	sync_values();

	await show_settings_modal(ctx, {
		title: 'Prompt presets',
		subtitle: () =>
			`base: ${selected_base ?? '(none)'} • ${enabled_layers.size} layer(s) enabled`,
		items,
		max_visible: Math.min(Math.max(items.length + 4, 8), 24),
		enable_search: true,
		on_change: (id, new_value) => {
			if (id.startsWith('__header_')) return;

			if (base_ids.has(id)) {
				selected_base =
					new_value === SELECTED && id !== NONE_BASE_ID
						? id
						: undefined;
				sync_values();
				return;
			}

			if (layer_ids.has(id)) {
				if (new_value === ENABLED) {
					enabled_layers.add(id);
				} else {
					enabled_layers.delete(id);
				}
				sync_values();
			}
		},
	});

	if (
		selected_base !== initial_base ||
		!sets_equal(initial_layers, enabled_layers)
	) {
		on_change(selected_base, enabled_layers);
	}
}
