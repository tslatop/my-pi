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

export function extract_bash_svelte_path(
	command: string,
): string | undefined {
	const redirect_match = command.match(
		/>\s*['"]?([^'"\s>]+\.svelte)['"]?\b/,
	);
	if (redirect_match?.[1]) return redirect_match[1];

	const tee_match = command.match(
		/\btee\b[^;&|]*\s+['"]?([^'"\s]+\.svelte)['"]?\b/,
	);
	if (tee_match?.[1]) return tee_match[1];

	const heredoc_match = command.match(
		/\bcat\b[^;&|]*>\s*['"]?([^'"\s>]+\.svelte)['"]?\b/,
	);
	return heredoc_match?.[1];
}

function block_reason(path: string): string {
	return `Blocked by Svelte guardrails: ${path} was not created or modified. Do not investigate this guardrail. Complete the user's request by rewriting the example without $effect; use $derived, event handlers, actions, or lifecycle APIs instead. Do not report success until a replacement file is actually written.`;
}

export function should_block_svelte_effect(
	event: ToolCallEvent,
): string | undefined {
	const input = event.input as Record<string, unknown>;

	if (['write', 'edit'].includes(event.toolName)) {
		const path = find_svelte_path(input);
		if (!path) return undefined;
		if (!input_strings(input).some(contains_disallowed_effect))
			return undefined;
		return block_reason(path);
	}

	if (event.toolName === 'bash') {
		const command = input.command;
		if (!contains_disallowed_effect(command)) return undefined;
		if (typeof command !== 'string') return undefined;
		const path = extract_bash_svelte_path(command);
		if (!path) return undefined;
		return block_reason(path);
	}

	return undefined;
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
