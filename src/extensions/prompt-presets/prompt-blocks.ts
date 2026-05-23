import type { LoadedPromptPreset } from './types.js';

export function build_active_prompt_blocks(
	presets: Record<string, LoadedPromptPreset>,
	active_base_name: string | undefined,
	active_layers: ReadonlySet<string>,
): string[] {
	const blocks: string[] = [];
	const base = active_base_name
		? presets[active_base_name]
		: undefined;
	if (base?.instructions.trim()) {
		blocks.push(
			`## Active Base Prompt: ${base.name}\n${base.instructions.trim()}`,
		);
	}

	const layer_blocks = [...active_layers]
		.sort()
		.map((name) => presets[name])
		.filter((preset): preset is LoadedPromptPreset =>
			Boolean(preset?.instructions.trim()),
		)
		.map(
			(preset) => `### ${preset.name}\n${preset.instructions.trim()}`,
		);
	if (layer_blocks.length > 0) {
		blocks.push(
			`## Active Prompt Layers\n\n${layer_blocks.join('\n\n')}`,
		);
	}

	return blocks;
}
