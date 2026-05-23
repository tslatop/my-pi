import { describe, expect, it } from 'vitest';
import type { PromptPresetManagerState } from './manager.js';
import type { LoadedPromptPreset } from './types.js';

function preset(
	name: string,
	kind: LoadedPromptPreset['kind'],
): LoadedPromptPreset {
	return { name, kind, instructions: name, source: 'builtin' };
}

describe('prompt preset manager state type', () => {
	it('accepts manager state with active layers', () => {
		const state: PromptPresetManagerState = {
			presets: {
				base: preset('base', 'base'),
				layer: preset('layer', 'layer'),
			},
			active_base_name: 'base',
			active_layers: new Set(['layer']),
		};
		expect([...state.active_layers]).toEqual(['layer']);
	});
});
