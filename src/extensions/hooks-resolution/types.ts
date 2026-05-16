export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export type HookEventName =
	| 'PreToolUse'
	| 'PostToolUse'
	| 'PostToolUseFailure';

export interface ResolvedCommandHook {
	event_name: HookEventName;
	matcher?: RegExp;
	matcher_text?: string;
	command: string;
	source: string;
}

export interface HookState {
	project_dir: string;
	hooks: ResolvedCommandHook[];
}

export interface HooksConfigInfo {
	project_dir: string;
	hash: string;
	sources: string[];
	hooks: Array<{
		event_name: HookEventName;
		matcher_text?: string;
		command: string;
		source: string;
	}>;
}

export interface CommandRunResult {
	code: number;
	stdout: string;
	stderr: string;
	elapsed_ms: number;
	timed_out: boolean;
}
