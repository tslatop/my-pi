import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	is_path_allowed,
	load_svelte_guardrails_config,
} from './config.js';
import {
	contains_disallowed_effect,
	extract_bash_svelte_path,
	is_svelte_path,
	should_block_svelte_effect,
} from './index.js';

const original_config_path =
	process.env.MY_PI_SVELTE_GUARDRAILS_CONFIG;

afterEach(() => {
	if (original_config_path === undefined) {
		delete process.env.MY_PI_SVELTE_GUARDRAILS_CONFIG;
	} else {
		process.env.MY_PI_SVELTE_GUARDRAILS_CONFIG = original_config_path;
	}
});

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
		).toContain('was not created or modified');

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

	it('blocks bash heredocs that create Svelte files with $effect', () => {
		const command = `cat > ExampleEffect.svelte <<'EOF'
<script>$effect(() => {})</script>
EOF`;

		expect(extract_bash_svelte_path(command)).toBe(
			'ExampleEffect.svelte',
		);
		expect(
			should_block_svelte_effect({
				type: 'tool_call',
				toolName: 'bash',
				toolCallId: '3',
				input: { command },
			} as any),
		).toContain('was not created or modified');
	});

	it('allows configured paths', () => {
		expect(
			is_path_allowed('examples/App.svelte', ['examples/**']),
		).toBe(true);
		expect(is_path_allowed('src/App.svelte', ['examples/**'])).toBe(
			false,
		);
		expect(
			should_block_svelte_effect(
				{
					type: 'tool_call',
					toolName: 'write',
					toolCallId: '4',
					input: {
						path: 'examples/App.svelte',
						content: '<script>$effect(() => {})</script>',
					},
				} as any,
				{
					version: 1,
					blockEffect: true,
					allow: ['examples/**'],
					mode: 'block',
				},
			),
		).toBeUndefined();
	});

	it('can disable the $effect rule from config', () => {
		expect(
			should_block_svelte_effect(
				{
					type: 'tool_call',
					toolName: 'write',
					toolCallId: '5',
					input: {
						path: 'src/App.svelte',
						content: '<script>$effect(() => {})</script>',
					},
				} as any,
				{ version: 1, blockEffect: false, allow: [], mode: 'block' },
			),
		).toBeUndefined();
	});

	it('loads config from the my-pi config path', () => {
		const dir = mkdtempSync(join(tmpdir(), 'svelte-guardrails-'));
		const path = join(dir, 'config.json');
		process.env.MY_PI_SVELTE_GUARDRAILS_CONFIG = path;
		writeFileSync(
			path,
			JSON.stringify({ blockEffect: false, allow: ['legacy/**'] }),
		);

		expect(load_svelte_guardrails_config()).toEqual({
			version: 1,
			blockEffect: false,
			allow: ['legacy/**'],
			mode: 'block',
		});
		rmSync(dir, { recursive: true, force: true });
	});
});
