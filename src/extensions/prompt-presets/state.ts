import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { save_persisted_prompt_state } from './storage.js';
import type {
	LoadedPromptPreset,
	PromptPresetState,
} from './types.js';

export const PRESET_STATE_TYPE = 'prompt-preset-state';
export const ENABLED = '● enabled';
export const DISABLED = '○ disabled';
export const SELECTED = '● selected';
export const UNSELECTED = '○';
export const NONE_BASE_ID = '__base_none__';

export function get_last_preset_state(
	ctx: ExtensionContext,
): PromptPresetState | undefined {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as {
			type?: string;
			customType?: string;
			data?: PromptPresetState;
		};
		if (
			entry.type === 'custom' &&
			entry.customType === PRESET_STATE_TYPE &&
			entry.data
		) {
			return entry.data;
		}
	}
	return undefined;
}

export function sets_equal(
	a: ReadonlySet<string>,
	b: ReadonlySet<string>,
): boolean {
	if (a.size !== b.size) return false;
	for (const value of a) {
		if (!b.has(value)) return false;
	}
	return true;
}

export function persist_state(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	active_base_name: string | undefined,
	active_layers: ReadonlySet<string>,
): void {
	const state = {
		base_name: active_base_name ?? null,
		layer_names: [...active_layers].sort(),
	};
	pi.appendEntry(PRESET_STATE_TYPE, state);
	save_persisted_prompt_state(ctx.cwd, state);
}

export function normalize_active_state(
	presets: Record<string, LoadedPromptPreset>,
	active_base_name: string | undefined,
	active_layers: ReadonlySet<string>,
): {
	active_base_name: string | undefined;
	active_layers: Set<string>;
} {
	const next_base_name =
		active_base_name && presets[active_base_name]?.kind === 'base'
			? active_base_name
			: undefined;
	const next_layers = new Set(
		[...active_layers].filter(
			(name) => presets[name]?.kind === 'layer',
		),
	);
	return {
		active_base_name: next_base_name,
		active_layers: next_layers,
	};
}

export function parse_preset_flag(flag: string): string[] {
	return flag
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}
