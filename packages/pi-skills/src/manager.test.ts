import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

function write_skill(
	base_dir: string,
	name: string,
	description: string,
): void {
	mkdirSync(base_dir, { recursive: true });
	writeFileSync(
		join(base_dir, 'SKILL.md'),
		`---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
	);
}

describe('create_skills_manager', () => {
	let root: string;
	let original_home: string | undefined;
	let original_xdg: string | undefined;
	let original_agent_dir: string | undefined;

	beforeEach(() => {
		root = join(
			tmpdir(),
			`my-pi-skills-manager-${Date.now()}-${Math.random()}`,
		);
		original_home = process.env.HOME;
		original_xdg = process.env.XDG_CONFIG_HOME;
		original_agent_dir = process.env.PI_CODING_AGENT_DIR;
		process.env.HOME = root;
		process.env.XDG_CONFIG_HOME = join(root, '.config');
		process.env.PI_CODING_AGENT_DIR = join(root, 'agent');
		vi.resetModules();
	});

	afterEach(() => {
		if (original_home === undefined) delete process.env.HOME;
		else process.env.HOME = original_home;
		if (original_xdg === undefined)
			delete process.env.XDG_CONFIG_HOME;
		else process.env.XDG_CONFIG_HOME = original_xdg;
		if (original_agent_dir === undefined)
			delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = original_agent_dir;
		rmSync(root, { recursive: true, force: true });
	});

	it('discovers project .agents skills as managed project skills', async () => {
		const project = join(root, 'repo');
		write_skill(
			join(project, '.agents', 'project-navigation'),
			'project-navigation',
			'Navigate this project.',
		);

		const { create_skills_manager } = await import('./manager.js');
		const mgr = create_skills_manager({ cwd: project });
		const skill = mgr
			.discover()
			.find((candidate) => candidate.name === 'project-navigation');

		expect(skill).toMatchObject({
			key: 'project-navigation@project:.agents',
			source: 'project:.agents',
			scope: 'project',
			enabled: true,
		});
		expect(mgr.get_enabled_skill_paths()).toContain(
			join(project, '.agents', 'project-navigation', 'SKILL.md'),
		);
	});

	it('discovers recursive SKILL.md and root .pi skill markdown files', async () => {
		const project = join(root, 'repo');
		write_skill(
			join(project, '.agents', 'skills', 'nested', 'deep'),
			'deep-skill',
			'Use the deep skill.',
		);
		mkdirSync(join(project, '.pi', 'skills'), { recursive: true });
		writeFileSync(
			join(project, '.pi', 'skills', 'root-helper.md'),
			'---\ndescription: Use the root helper.\n---\n\n# Root helper\n',
		);

		const { create_skills_manager } = await import('./manager.js');
		const mgr = create_skills_manager({ cwd: project });
		const skills = mgr.discover();

		expect(
			skills.find((candidate) => candidate.name === 'deep-skill'),
		).toMatchObject({ source: 'project:.agents/skills' });
		expect(
			skills.find((candidate) => candidate.name === 'root-helper'),
		).toMatchObject({ source: 'project:.pi/skills' });
	});

	it('does not return default pi-native skills as explicit skill paths', async () => {
		write_skill(
			join(root, 'agent', 'skills', 'local-tooling'),
			'local-tooling',
			'Use local tooling.',
		);

		const { create_skills_manager } = await import('./manager.js');
		const mgr = create_skills_manager();
		mgr.enable('local-tooling@pi-native');

		expect(
			mgr.discover().find((skill) => skill.name === 'local-tooling')
				?.enabled,
		).toBe(true);
		expect(mgr.get_enabled_skill_paths()).not.toContain(
			join(root, 'agent', 'skills', 'local-tooling', 'SKILL.md'),
		);
	});

	it('uses context profiles to enable global skills without hardcoding project names', async () => {
		const project = join(root, 'repos', 'cloud-lobsters', 'jupiter');
		write_skill(
			join(root, 'agent', 'skills', 'cl-duncan-table'),
			'cl-duncan-table',
			'Use for Cloud Lobsters tables.',
		);
		mkdirSync(join(root, '.config', 'my-pi'), { recursive: true });
		writeFileSync(
			join(root, '.config', 'my-pi', 'skills.json'),
			JSON.stringify({
				version: 3,
				enabled: {},
				defaults: 'all-disabled',
				current_profile: 'default',
				profiles: {
					default: { include: [], exclude: [] },
					cloud: { include: ['cl-*'], exclude: [] },
				},
				contexts: [
					{
						name: 'cloud repos',
						profile: 'cloud',
						when: { cwd: join(root, 'repos', 'cloud-lobsters', '*') },
					},
				],
			}),
		);

		const { create_skills_manager } = await import('./manager.js');

		expect(
			create_skills_manager({ cwd: join(root, 'other') })
				.discover()
				.find((skill) => skill.name === 'cl-duncan-table')?.enabled,
		).toBe(false);
		expect(
			create_skills_manager({ cwd: project })
				.discover()
				.find((skill) => skill.name === 'cl-duncan-table')?.enabled,
		).toBe(true);
	});

	it('can disable project skill injection for untrusted repos', async () => {
		const project = join(root, 'repo');
		write_skill(
			join(project, '.agents', 'project-navigation'),
			'project-navigation',
			'Navigate this project.',
		);

		const { create_skills_manager } = await import('./manager.js');
		const mgr = create_skills_manager({
			cwd: project,
			project_skills_enabled: false,
		});

		expect(
			mgr
				.discover()
				.find((skill) => skill.name === 'project-navigation')
				?.enabled,
		).toBe(false);
		expect(mgr.get_enabled_skill_paths()).not.toContain(
			join(project, '.agents', 'project-navigation', 'SKILL.md'),
		);
	});
});
