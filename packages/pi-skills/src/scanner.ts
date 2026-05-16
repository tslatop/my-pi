import {
	getAgentDir,
	parseFrontmatter,
	type SkillFrontmatter,
} from '@earendil-works/pi-coding-agent';
import {
	existsSync,
	globSync,
	readFileSync,
	statSync,
} from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';

export type SkillScope = 'global' | 'project';

export interface DiscoveredSkill {
	name: string;
	description: string;
	skillPath: string;
	baseDir: string;
	source: string;
	scope: SkillScope;
	kind: 'managed';
}

function parse_skill_md(
	skill_path: string,
): { name: string; description: string } | null {
	try {
		const content = readFileSync(skill_path, 'utf-8');
		const { frontmatter } =
			parseFrontmatter<SkillFrontmatter>(content);
		const description = frontmatter?.description;
		if (!description) return null;

		const name = frontmatter?.name || parse(dirname(skill_path)).base;
		return { name, description: description.trim() };
	} catch {
		return null;
	}
}

function scan_dir_for_skills(
	dir: string,
	options: {
		source: string;
		scope: SkillScope;
		include_direct_root_skill?: boolean;
	},
): DiscoveredSkill[] {
	if (!existsSync(dir)) return [];

	const results: DiscoveredSkill[] = [];
	const direct = join(dir, 'SKILL.md');
	const include_direct_root_skill =
		options.include_direct_root_skill ?? true;

	if (include_direct_root_skill && existsSync(direct)) {
		const parsed = parse_skill_md(direct);
		if (parsed) {
			results.push({
				...parsed,
				skillPath: direct,
				baseDir: dir,
				source: options.source,
				scope: options.scope,
				kind: 'managed',
			});
		}
		return results;
	}

	try {
		const matches = globSync('*/SKILL.md', { cwd: dir });
		for (const match of matches) {
			const full_path = resolve(dir, match);
			const parsed = parse_skill_md(full_path);
			if (parsed) {
				const base_dir = dirname(full_path);
				results.push({
					...parsed,
					skillPath: full_path,
					baseDir: base_dir,
					source: options.source,
					scope: options.scope,
					kind: 'managed',
				});
			}
		}
	} catch {
		// skip inaccessible dirs
	}

	return results;
}

function dedupe_by_skill_path(
	skills: DiscoveredSkill[],
): DiscoveredSkill[] {
	const seen = new Set<string>();
	const deduped: DiscoveredSkill[] = [];

	for (const skill of skills) {
		if (seen.has(skill.skillPath)) continue;
		seen.add(skill.skillPath);
		deduped.push(skill);
	}

	return deduped;
}

export function scan_managed_skills(): DiscoveredSkill[] {
	return dedupe_by_skill_path(
		scan_dir_for_skills(join(getAgentDir(), 'skills'), {
			source: 'pi-native',
			scope: 'global',
			include_direct_root_skill: false,
		}),
	);
}

function parent_dir(path: string): string | null {
	const parsed = parse(path);
	const parent = dirname(path);
	return parent === path || parent === parsed.root ? null : parent;
}

function is_directory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function project_roots(cwd: string): string[] {
	const roots: string[] = [];
	let current = resolve(cwd);
	while (true) {
		roots.push(current);
		if (is_directory(join(current, '.git'))) break;
		const parent = parent_dir(current);
		if (!parent) break;
		current = parent;
	}
	return roots;
}

export function scan_project_skills(
	cwd = process.cwd(),
): DiscoveredSkill[] {
	const skills: DiscoveredSkill[] = [];
	for (const root of project_roots(cwd)) {
		for (const skill of scan_dir_for_skills(join(root, '.agents'), {
			source: 'project:.agents',
			scope: 'project',
			include_direct_root_skill: false,
		})) {
			skills.push(skill);
		}
		for (const skill of scan_dir_for_skills(
			join(root, '.agents', 'skills'),
			{
				source: 'project:.agents/skills',
				scope: 'project',
				include_direct_root_skill: false,
			},
		)) {
			skills.push(skill);
		}
		for (const skill of scan_dir_for_skills(
			join(root, '.pi', 'skills'),
			{
				source: 'project:.pi/skills',
				scope: 'project',
				include_direct_root_skill: false,
			},
		)) {
			skills.push(skill);
		}
	}
	return dedupe_by_skill_path(skills);
}

export function scan_all_skills(
	cwd = process.cwd(),
): DiscoveredSkill[] {
	return [...scan_managed_skills(), ...scan_project_skills(cwd)];
}
