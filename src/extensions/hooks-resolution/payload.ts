import type {
	ExtensionContext,
	ToolCallEvent,
	ToolResultEvent,
} from '@earendil-works/pi-coding-agent';
import type { HookEventName, ResolvedCommandHook } from './types.js';

export function to_claude_tool_name(tool_name: string): string {
	if (tool_name === 'ls') return 'LS';
	if (tool_name.length === 0) return tool_name;
	return tool_name[0].toUpperCase() + tool_name.slice(1);
}

export function matches_hook(
	hook: ResolvedCommandHook,
	tool_name: string,
): boolean {
	if (!hook.matcher) return true;

	const claude_tool_name = to_claude_tool_name(tool_name);
	hook.matcher.lastIndex = 0;
	if (hook.matcher.test(tool_name)) return true;

	hook.matcher.lastIndex = 0;
	return hook.matcher.test(claude_tool_name);
}

export function extract_text_content(content: unknown): string {
	if (!Array.isArray(content)) return '';

	const parts: string[] = [];
	for (const item of content) {
		if (!item || typeof item !== 'object') continue;
		const item_record = item as Record<string, unknown>;
		if (
			item_record.type === 'text' &&
			typeof item_record.text === 'string'
		) {
			parts.push(item_record.text);
		}
	}

	return parts.join('\n');
}

export function normalize_tool_input(
	input: Record<string, unknown>,
): Record<string, unknown> {
	const normalized: Record<string, unknown> = { ...input };
	const path_value =
		typeof input.path === 'string' ? input.path : undefined;
	if (path_value !== undefined) {
		normalized.file_path = path_value;
		normalized.filePath = path_value;
	}
	return normalized;
}

export function build_tool_response(
	event: ToolResultEvent,
	normalized_input: Record<string, unknown>,
): Record<string, unknown> {
	const response: Record<string, unknown> = {
		is_error: event.isError,
		isError: event.isError,
		content: event.content,
		text: extract_text_content(event.content),
		details: event.details ?? null,
	};

	const file_path =
		typeof normalized_input.file_path === 'string'
			? normalized_input.file_path
			: undefined;
	if (file_path !== undefined) {
		response.file_path = file_path;
		response.filePath = file_path;
	}

	return response;
}

export function build_hook_payload(
	event: ToolCallEvent | ToolResultEvent,
	event_name: HookEventName,
	ctx: ExtensionContext,
	project_dir: string,
): Record<string, unknown> {
	const normalized_input = normalize_tool_input(
		event.input as Record<string, unknown>,
	);
	const session_id =
		ctx.sessionManager.getSessionFile() ?? 'ephemeral';
	const payload: Record<string, unknown> = {
		session_id,
		cwd: ctx.cwd,
		claude_project_dir: project_dir,
		hook_event_name: event_name,
		tool_name: to_claude_tool_name(event.toolName),
		tool_call_id: event.toolCallId,
		tool_input: normalized_input,
	};

	if ('content' in event) {
		payload.tool_response = build_tool_response(
			event,
			normalized_input,
		);
	}

	return payload;
}
