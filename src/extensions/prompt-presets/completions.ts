import { list_base_presets, list_layer_presets } from './catalog.js';
import type { LoadedPromptPreset } from './types.js';

const SUBCOMMANDS = [
	'help',
	'list',
	'show',
	'clear',
	'edit',
	'edit-global',
	'export-defaults',
	'delete',
	'reset',
	'reload',
	'base',
	'enable',
	'disable',
	'toggle',
];

export function get_prompt_preset_completions(
	presets: Record<string, LoadedPromptPreset>,
	prefix: string,
): Array<{ value: string; label: string }> | null {
	const trimmed = prefix.trim();
	const parts = trimmed ? trimmed.split(/\s+/) : [];
	const base_names = list_base_presets(presets).map(
		(preset) => preset.name,
	);
	const layer_names = list_layer_presets(presets).map(
		(preset) => preset.name,
	);
	const all_names = [...base_names, ...layer_names];

	if (parts.length <= 1) {
		const query = parts[0] ?? '';
		return [
			...SUBCOMMANDS.filter((item) => item.startsWith(query)).map(
				(item) => ({ value: item, label: item }),
			),
			...all_names
				.filter((item) => item.startsWith(query))
				.map((item) => ({ value: item, label: item })),
		];
	}

	const command = parts[0];
	const query = parts.slice(1).join(' ');
	if (command === 'base') {
		return base_names
			.filter((item) => item.startsWith(query))
			.map((item) => ({ value: `base ${item}`, label: item }));
	}
	if (['enable', 'disable', 'toggle'].includes(command)) {
		return layer_names
			.filter((item) => item.startsWith(query))
			.map((item) => ({
				value: `${command} ${item}`,
				label: item,
			}));
	}
	if (command === 'edit' || command === 'edit-global') {
		return all_names
			.filter((item) => item.startsWith(query))
			.map((item) => ({
				value: `${command} ${item}`,
				label: item,
			}));
	}
	if (['delete', 'reset'].includes(command)) {
		return all_names
			.filter((item) => item.startsWith(query))
			.map((item) => ({
				value: `${command} ${item}`,
				label: item,
			}));
	}
	return null;
}
