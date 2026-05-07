import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	apply_untrusted_repo_defaults,
	create_lazy_builtin_extension_factory,
	create_my_pi,
	get_force_disabled_builtins,
	resolve_effective_thinking_level,
	resolve_model_reference,
} from './api.js';

const original_agent_dir = process.env.PI_CODING_AGENT_DIR;
const original_runtime_mode = process.env.MY_PI_RUNTIME_MODE;
const original_mcp_project_config =
	process.env.MY_PI_MCP_PROJECT_CONFIG;
const original_project_skills = process.env.MY_PI_PROJECT_SKILLS;
const original_xdg_config_home = process.env.XDG_CONFIG_HOME;

function restore_env(): void {
	if (original_agent_dir === undefined)
		delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = original_agent_dir;
	if (original_runtime_mode === undefined)
		delete process.env.MY_PI_RUNTIME_MODE;
	else process.env.MY_PI_RUNTIME_MODE = original_runtime_mode;
	if (original_mcp_project_config === undefined)
		delete process.env.MY_PI_MCP_PROJECT_CONFIG;
	else
		process.env.MY_PI_MCP_PROJECT_CONFIG =
			original_mcp_project_config;
	if (original_project_skills === undefined)
		delete process.env.MY_PI_PROJECT_SKILLS;
	else process.env.MY_PI_PROJECT_SKILLS = original_project_skills;
	if (original_xdg_config_home === undefined)
		delete process.env.XDG_CONFIG_HOME;
	else process.env.XDG_CONFIG_HOME = original_xdg_config_home;
}

afterEach(() => {
	restore_env();
});

describe('get_force_disabled_builtins', () => {
	const enabled = {
		context_sidecar: true,
		mcp: true,
		skills: true,
		filter_output: true,
		recall: true,
		nopeek: true,
		omnisearch: true,
		sqlite_tools: true,
		startup_screen: true,
		prompt_presets: true,
		lsp: true,
		session_name: true,
		confirm_destructive: true,
		hooks_resolution: true,
		team_mode: true,
	} as const;

	it('keeps UI-only built-ins enabled in interactive mode', () => {
		const disabled = get_force_disabled_builtins({
			...enabled,
			runtime_mode: 'interactive',
		});

		expect(disabled.has('session-name')).toBe(false);
		expect(disabled.has('startup-screen')).toBe(false);
		expect(disabled.has('confirm-destructive')).toBe(false);
	});

	it('disables UI-only built-ins in print mode', () => {
		const disabled = get_force_disabled_builtins({
			...enabled,
			runtime_mode: 'print',
		});

		expect(disabled.has('session-name')).toBe(true);
		expect(disabled.has('startup-screen')).toBe(true);
		expect(disabled.has('confirm-destructive')).toBe(false);
		expect(disabled.has('mcp')).toBe(false);
		expect(disabled.has('prompt-presets')).toBe(false);
		expect(disabled.has('lsp')).toBe(false);
	});

	it('still respects explicit CLI disables', () => {
		const disabled = get_force_disabled_builtins({
			...enabled,
			runtime_mode: 'json',
			mcp: false,
			recall: false,
		});

		expect(disabled.has('mcp')).toBe(true);
		expect(disabled.has('recall')).toBe(true);
		expect(disabled.has('nopeek')).toBe(false);
		expect(disabled.has('omnisearch')).toBe(false);
		expect(disabled.has('sqlite-tools')).toBe(false);
	});
});

describe('create_lazy_builtin_extension_factory', () => {
	it('does not load force-disabled built-ins', async () => {
		let loaded = 0;
		const extension = create_lazy_builtin_extension_factory(
			'mcp',
			async () => {
				loaded++;
				return async () => undefined;
			},
			new Set(['mcp']),
		);

		await extension({} as never);

		expect(loaded).toBe(0);
	});

	it('does not load config-disabled built-ins', async () => {
		const xdg_config_home = mkdtempSync(
			join(tmpdir(), 'my-pi-api-config-'),
		);
		let loaded = 0;

		try {
			process.env.XDG_CONFIG_HOME = xdg_config_home;
			mkdirSync(join(xdg_config_home, 'my-pi'), {
				recursive: true,
			});
			writeFileSync(
				join(xdg_config_home, 'my-pi', 'extensions.json'),
				JSON.stringify({
					version: 1,
					enabled: { mcp: false },
				}),
			);

			const extension = create_lazy_builtin_extension_factory(
				'mcp',
				async () => {
					loaded++;
					return async () => undefined;
				},
				new Set(),
			);

			await extension({} as never);

			expect(loaded).toBe(0);
		} finally {
			rmSync(xdg_config_home, { recursive: true, force: true });
		}
	});

	it('loads enabled built-ins only when the wrapper runs', async () => {
		let loaded = 0;
		let ran = 0;
		const extension = create_lazy_builtin_extension_factory(
			'mcp',
			async () => {
				loaded++;
				return async () => {
					ran++;
				};
			},
			new Set(),
		);

		expect(loaded).toBe(0);
		await extension({} as never);

		expect(loaded).toBe(1);
		expect(ran).toBe(1);
	});
});

describe('apply_untrusted_repo_defaults', () => {
	it('sets conservative project-resource defaults without overriding explicit enables', () => {
		const env: NodeJS.ProcessEnv = {
			MY_PI_MCP_PROJECT_CONFIG: 'allow',
		};

		expect(apply_untrusted_repo_defaults(env)).toEqual([
			'MY_PI_HOOKS_CONFIG',
			'MY_PI_LSP_PROJECT_BINARY',
			'MY_PI_PROMPT_PRESETS_PROJECT',
			'MY_PI_PROJECT_SKILLS',
			'MY_PI_TEAM_PROFILES_PROJECT',
			'MY_PI_CHILD_ENV_ALLOWLIST',
			'MY_PI_MCP_ENV_ALLOWLIST',
			'MY_PI_LSP_ENV_ALLOWLIST',
			'MY_PI_HOOKS_ENV_ALLOWLIST',
			'MY_PI_TEAM_MODE_ENV_ALLOWLIST',
		]);
		expect(env).toMatchObject({
			MY_PI_MCP_PROJECT_CONFIG: 'allow',
			MY_PI_HOOKS_CONFIG: 'skip',
			MY_PI_LSP_PROJECT_BINARY: 'global',
			MY_PI_PROMPT_PRESETS_PROJECT: 'skip',
			MY_PI_PROJECT_SKILLS: 'skip',
			MY_PI_TEAM_PROFILES_PROJECT: 'skip',
			MY_PI_CHILD_ENV_ALLOWLIST: '',
			MY_PI_MCP_ENV_ALLOWLIST: '',
			MY_PI_LSP_ENV_ALLOWLIST: '',
			MY_PI_HOOKS_ENV_ALLOWLIST: '',
			MY_PI_TEAM_MODE_ENV_ALLOWLIST: '',
		});
	});
});

describe('create_my_pi environment scoping', () => {
	const disabled_builtins = {
		context_sidecar: false,
		mcp: false,
		skills: false,
		filter_output: false,
		recall: false,
		nopeek: false,
		omnisearch: false,
		sqlite_tools: false,
		prompt_presets: false,
		lsp: false,
		session_name: false,
		confirm_destructive: false,
		hooks_resolution: false,
		team_mode: false,
	} as const;

	it('restores process env overrides when the runtime is disposed', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'my-pi-api-env-'));
		process.env.PI_CODING_AGENT_DIR = '/tmp/original-agent';
		process.env.MY_PI_RUNTIME_MODE = 'interactive';

		try {
			const runtime = await create_my_pi({
				cwd,
				agent_dir: 'isolated-agent',
				runtime_mode: 'json',
				...disabled_builtins,
			});

			expect(process.env.PI_CODING_AGENT_DIR).toBe(
				join(cwd, 'isolated-agent'),
			);
			expect(process.env.MY_PI_RUNTIME_MODE).toBe('json');

			await runtime.dispose();

			expect(process.env.PI_CODING_AGENT_DIR).toBe(
				'/tmp/original-agent',
			);
			expect(process.env.MY_PI_RUNTIME_MODE).toBe('interactive');
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	it('does not let one disposed runtime poison the next runtime agent dir', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'my-pi-api-seq-'));
		delete process.env.PI_CODING_AGENT_DIR;

		try {
			const first = await create_my_pi({
				cwd,
				agent_dir: 'agent-a',
				runtime_mode: 'json',
				...disabled_builtins,
			});
			await first.dispose();
			expect(process.env.PI_CODING_AGENT_DIR).toBeUndefined();

			const second = await create_my_pi({
				cwd,
				runtime_mode: 'json',
				...disabled_builtins,
			});
			expect(second.services.agentDir).not.toBe(join(cwd, 'agent-a'));
			await second.dispose();
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	it('restores untrusted defaults that it applied for the runtime', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'my-pi-api-untrusted-'));
		delete process.env.MY_PI_MCP_PROJECT_CONFIG;

		try {
			const runtime = await create_my_pi({
				cwd,
				runtime_mode: 'json',
				untrusted_repo: true,
				...disabled_builtins,
			});
			expect(process.env.MY_PI_MCP_PROJECT_CONFIG).toBe('skip');
			await runtime.dispose();
			expect(process.env.MY_PI_MCP_PROJECT_CONFIG).toBeUndefined();
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	it('reloads skill profile changes into the resource filter', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'my-pi-api-skills-'));
		const xdg_config_home = mkdtempSync(
			join(tmpdir(), 'my-pi-api-skills-config-'),
		);
		const agent_dir = join(cwd, 'agent');
		const skill_dir = join(agent_dir, 'skills', 'cl-duncan-table');
		const skills_config = join(
			xdg_config_home,
			'my-pi',
			'skills.json',
		);

		try {
			process.env.XDG_CONFIG_HOME = xdg_config_home;
			mkdirSync(skill_dir, { recursive: true });
			mkdirSync(join(xdg_config_home, 'my-pi'), { recursive: true });
			writeFileSync(
				join(skill_dir, 'SKILL.md'),
				`---\nname: cl-duncan-table\ndescription: Duncan table test skill.\n---\n\n# Duncan\n`,
			);
			writeFileSync(
				skills_config,
				JSON.stringify({
					version: 3,
					enabled: {},
					defaults: 'all-disabled',
					current_profile: 'blocked',
					profiles: {
						blocked: { include: [], exclude: ['cl-*'] },
						allowed: { include: ['cl-*'], exclude: [] },
					},
				}),
			);

			const runtime = await create_my_pi({
				cwd,
				agent_dir,
				runtime_mode: 'json',
				...disabled_builtins,
				skills: true,
			});
			const get_skill_names = () =>
				runtime.services.resourceLoader
					.getSkills()
					.skills.map((skill) => skill.name);

			expect(get_skill_names()).not.toContain('cl-duncan-table');
			writeFileSync(
				skills_config,
				JSON.stringify({
					version: 3,
					enabled: {},
					defaults: 'all-disabled',
					current_profile: 'allowed',
					profiles: {
						blocked: { include: [], exclude: ['cl-*'] },
						allowed: { include: ['cl-*'], exclude: [] },
					},
				}),
			);

			await runtime.session.reload();
			expect(get_skill_names()).toContain('cl-duncan-table');
			await runtime.dispose();
		} finally {
			rmSync(cwd, { recursive: true, force: true });
			rmSync(xdg_config_home, { recursive: true, force: true });
		}
	});

	it('loads TypeScript extension files through the upstream extension loader', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'my-pi-api-ts-ext-'));
		const agent_dir = join(cwd, 'agent');
		const extension_path = join(cwd, 'ts-extension.ts');

		try {
			writeFileSync(
				extension_path,
				`import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function tsExtension(pi: ExtensionAPI) {
	pi.registerCommand('ts-extension-smoke', {
		description: 'TypeScript extension smoke test',
		async handler() {},
	});
}
`,
			);

			const runtime = await create_my_pi({
				cwd,
				agent_dir,
				runtime_mode: 'json',
				extensions: [extension_path],
				...disabled_builtins,
			});

			try {
				expect(
					runtime.services.resourceLoader
						.getExtensions()
						.extensions.flatMap((extension) => [
							...extension.commands.keys(),
						]),
				).toContain('ts-extension-smoke');
			} finally {
				await runtime.dispose();
			}
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	it('injects project .agents skills and honors untrusted project skill gating', async () => {
		const cwd = mkdtempSync(
			join(tmpdir(), 'my-pi-api-project-skills-'),
		);
		const xdg_config_home = mkdtempSync(
			join(tmpdir(), 'my-pi-api-project-skills-config-'),
		);
		const agent_dir = join(cwd, 'agent');
		const project_skill_dir = join(
			cwd,
			'.agents',
			'project-navigation',
		);

		try {
			process.env.XDG_CONFIG_HOME = xdg_config_home;
			mkdirSync(project_skill_dir, { recursive: true });
			writeFileSync(
				join(project_skill_dir, 'SKILL.md'),
				`---\nname: project-navigation\ndescription: Project navigation test skill.\n---\n\n# Project\n`,
			);

			const runtime = await create_my_pi({
				cwd,
				agent_dir,
				runtime_mode: 'json',
				...disabled_builtins,
				skills: true,
			});
			const get_skill_names = () =>
				runtime.services.resourceLoader
					.getSkills()
					.skills.map((skill) => skill.name);

			expect(get_skill_names()).toContain('project-navigation');
			await runtime.dispose();

			process.env.MY_PI_PROJECT_SKILLS = 'skip';
			const untrusted = await create_my_pi({
				cwd,
				agent_dir,
				runtime_mode: 'json',
				...disabled_builtins,
				skills: true,
			});
			expect(
				untrusted.services.resourceLoader
					.getSkills()
					.skills.map((skill) => skill.name),
			).not.toContain('project-navigation');
			await untrusted.dispose();
		} finally {
			rmSync(cwd, { recursive: true, force: true });
			rmSync(xdg_config_home, { recursive: true, force: true });
		}
	});
});

function make_model(overrides: Record<string, unknown> = {}) {
	return {
		id: 'test-model',
		name: 'Test Model',
		api: 'openai-completions',
		provider: 'test',
		baseUrl: 'http://localhost/v1',
		reasoning: true,
		input: ['text'],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
		...overrides,
	} as any;
}

describe('resolve_effective_thinking_level', () => {
	it('clamps requested thinking to levels supported by the model', () => {
		const high_only_model = make_model({
			thinkingLevelMap: {
				minimal: null,
				low: null,
				medium: null,
				high: 'high',
				xhigh: null,
			},
		});

		expect(
			resolve_effective_thinking_level(high_only_model, 'medium'),
		).toBe('high');
	});

	it('keeps requested thinking unchanged when no model is selected yet', () => {
		expect(resolve_effective_thinking_level(undefined, 'xhigh')).toBe(
			'xhigh',
		);
	});
});

describe('resolve_model_reference', () => {
	const cloudflare_model = {
		provider: 'cloudflare-workers-ai',
		id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
	};
	const openrouter_model = {
		provider: 'openrouter',
		id: 'openai/gpt-4o:extended',
	};
	const registry = {
		getAll: () => [cloudflare_model, openrouter_model] as any,
	};

	it('resolves provider/model references whose model IDs contain slashes', () => {
		expect(
			resolve_model_reference(
				'cloudflare-workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
				registry,
			),
		).toBe(cloudflare_model);
	});

	it('falls back to raw slash-containing model IDs', () => {
		expect(
			resolve_model_reference('openai/gpt-4o:extended', registry),
		).toBe(openrouter_model);
	});
});
