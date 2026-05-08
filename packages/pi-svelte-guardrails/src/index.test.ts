import { describe, expect, it } from 'vitest';
import {
	contains_disallowed_effect,
	is_svelte_path,
	should_block_svelte_effect,
} from './index.js';

describe('svelte guardrails', () => {
	it('detects Svelte file paths and $effect usage', () => {
		expect(is_svelte_path('src/App.svelte')).toBe(true);
		expect(is_svelte_path('src/App.ts')).toBe(false);
		expect(contains_disallowed_effect('$effect(() => {})')).toBe(
			true,
		);
		expect(contains_disallowed_effect('$derived(value)')).toBe(false);
	});

	it('blocks write/edit calls that introduce $effect in Svelte files', () => {
		expect(
			should_block_svelte_effect({
				type: 'tool_call',
				toolName: 'write',
				toolCallId: '1',
				input: {
					path: 'src/App.svelte',
					content: '<script>$effect(() => {})</script>',
				},
			} as any),
		).toContain('Do not use $effect');

		expect(
			should_block_svelte_effect({
				type: 'tool_call',
				toolName: 'write',
				toolCallId: '2',
				input: {
					path: 'src/App.svelte',
					content: '<script>const value = $derived(count)</script>',
				},
			} as any),
		).toBeUndefined();
	});
});
