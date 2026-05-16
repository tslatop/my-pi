import { type SettingItem } from '@earendil-works/pi-tui';
import type { ManagedSkill, SkillProfile } from './manager.js';

export const ENABLED = '● enabled';
export const DISABLED = '○ disabled';

export function sort_skills(skills: ManagedSkill[]): ManagedSkill[] {
	return [...skills].sort((a, b) => {
		const by_name = a.name.localeCompare(b.name);
		if (by_name !== 0) return by_name;
		const by_source = a.source.localeCompare(b.source);
		if (by_source !== 0) return by_source;
		return a.key.localeCompare(b.key);
	});
}

export function to_setting_item(skill: ManagedSkill): SettingItem {
	return {
		id: skill.key,
		label: skill.name,
		description: [
			`${skill.source} • ${skill.key}`,
			skill.description,
			skill.baseDir,
		].join('\n'),
		currentValue: skill.enabled ? ENABLED : DISABLED,
		values: [ENABLED, DISABLED],
	};
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

export function skill_status(skill: ManagedSkill): string {
	return skill.enabled ? 'enabled' : 'disabled';
}

export function format_skill_detail(skill: ManagedSkill): string {
	return [
		`# ${skill.name}`,
		'',
		`Status: ${skill_status(skill)}`,
		`Source: ${skill.source}`,
		`Key: ${skill.key}`,
		`Kind: ${skill.kind}`,
		'',
		skill.description,
		'',
		`Base directory: ${skill.baseDir}`,
		`Skill file: ${skill.skillPath}`,
	].join('\n');
}

export function format_skill_list(skills: ManagedSkill[]): string {
	if (skills.length === 0) return 'No skills found.';
	return sort_skills(skills)
		.map(
			(skill) =>
				`${skill_status(skill).padEnd(10)} ${skill.name} (${skill.key})`,
		)
		.join('\n');
}

export function find_skill(
	skills: ManagedSkill[],
	key_or_name: string,
): ManagedSkill {
	const query = key_or_name.trim();
	const exact_key = skills.find((skill) => skill.key === query);
	if (exact_key) return exact_key;

	const exact_name = skills.filter((skill) => skill.name === query);
	if (exact_name.length === 1) return exact_name[0]!;
	if (exact_name.length > 1) {
		throw new Error(
			`Multiple skills named ${query}. Use an exact key instead.`,
		);
	}

	const lower = query.toLowerCase();
	const fuzzy = skills.filter(
		(skill) =>
			skill.key.toLowerCase() === lower ||
			skill.name.toLowerCase() === lower,
	);
	if (fuzzy.length === 1) return fuzzy[0]!;
	if (fuzzy.length > 1) {
		throw new Error(
			`Multiple skills matched ${query}. Use an exact key instead.`,
		);
	}

	throw new Error(`Unknown skill: ${query}`);
}

export function profile_description(profile: SkillProfile): string {
	const parts = [profile.active ? 'active' : 'inactive'];
	if (profile.extends.length) {
		parts.push(`extends ${profile.extends.join(', ')}`);
	}
	parts.push(`${profile.include.length} include`);
	parts.push(`${profile.exclude.length} exclude`);
	return parts.join(' • ');
}

export function format_profile_detail(profile: SkillProfile): string {
	const lines = [
		`# ${profile.name}`,
		'',
		profile_description(profile),
	];
	if (profile.description) {
		lines.push('', profile.description);
	}
	lines.push(
		'',
		'Include rules:',
		...(profile.include.length ? profile.include : ['(none)']),
		'',
		'Exclude rules:',
		...(profile.exclude.length ? profile.exclude : ['(none)']),
	);
	return lines.join('\n');
}
