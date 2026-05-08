// Svelte guardrails for Pi agents.

import type {
	ExtensionAPI,
	ToolCallEvent,
	ToolCallEventResult,
} from '@earendil-works/pi-coding-agent';

const SVELTE_FILE_RE = /\.svelte(?:\.|$|\?)/;
const EFFECT_RE = /\$effect(?:\s*\(|\s*\.)/;

export function is_svelte_path(value: unknown): boolean {
	return typeof value === 'string' && SVELTE_FILE_RE.test(value);
}

export function contains_disallowed_effect(value: unknown): boolean {
	return typeof value === 'string' && EFFECT_RE.test(value);
}

export function find_svelte_path(
	input: Record<string, unknown>,
): string | undefined {
	for (const key of ['path', 'file_path', 'filePath']) {
		const value = input[key];
		if (typeof value === 'string' && is_svelte_path(value))
			return value;
	}
	return undefined;
}

function input_strings(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(input_strings);
	if (!value || typeof value !== 'object') return [];
	return Object.values(value as Record<string, unknown>).flatMap(
		input_strings,
	);
}

export function should_block_svelte_effect(
	event: ToolCallEvent,
): string | undefined {
	if (!['write', 'edit'].includes(event.toolName)) return undefined;
	const input = event.input as Record<string, unknown>;
	const path = find_svelte_path(input);
	if (!path) return undefined;
	if (!input_strings(input).some(contains_disallowed_effect))
		return undefined;
	return `Do not use $effect in Svelte components: ${path}. Prefer $derived, event handlers, actions, or explicit lifecycle alternatives.`;
}

export default function svelte_guardrails(pi: ExtensionAPI) {
	pi.on(
		'tool_call',
		async (event): Promise<ToolCallEventResult | undefined> => {
			const reason = should_block_svelte_effect(event);
			if (!reason) return undefined;
			return { block: true, reason };
		},
	);
}
