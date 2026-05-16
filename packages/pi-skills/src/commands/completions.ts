import type { create_skills_manager } from '../manager.js';
import { sort_skills } from '../skill-utils.js';

type SkillsManager = ReturnType<typeof create_skills_manager>;

export const SKILL_SUBCOMMANDS = [
	'list',
	'show',
	'enable',
	'disable',
	'add',
	'import',
	'sync',
	'update',
	'profile',
	'refresh',
	'defaults',
];

export function get_skill_argument_completions(
	prefix: string,
	mgr: SkillsManager,
) {
	const parts = prefix.trimStart().split(/\s+/);
	const has_trailing_space = /\s$/.test(prefix);
	if (parts.length <= 1 && !has_trailing_space) {
		return SKILL_SUBCOMMANDS.filter((s) =>
			s.startsWith(parts[0] || ''),
		).map((s) => ({ value: s, label: s }));
	}

	if (['show', 'enable', 'disable'].includes(parts[0] ?? '')) {
		const q = parts.slice(1).join(' ').toLowerCase();
		const skills =
			parts[0] === 'show'
				? [...mgr.discover(), ...mgr.discover_importable()]
				: mgr.discover();
		return sort_skills(skills)
			.filter(
				(s) =>
					s.key.toLowerCase().includes(q) ||
					s.name.toLowerCase().includes(q),
			)
			.slice(0, 20)
			.map((s) => ({
				value: `${parts[0]} ${s.key}`,
				label: s.key,
			}));
	}

	if (parts[0] === 'import') {
		const q = parts.slice(1).join(' ').toLowerCase();
		return sort_skills(mgr.discover_importable())
			.filter(
				(s) =>
					s.key.toLowerCase().includes(q) ||
					s.name.toLowerCase().includes(q),
			)
			.slice(0, 20)
			.map((s) => ({
				value: `${parts[0]} ${s.key}`,
				label: s.key,
			}));
	}

	if (parts[0] === 'update') {
		return ['--dry-run', '--all', '--force', '--unpin']
			.filter((flag) => flag.startsWith(parts.at(-1) ?? ''))
			.map((flag) => ({
				value: `${parts.slice(0, -1).join(' ')} ${flag}`.trim(),
				label: flag,
			}));
	}

	if (parts[0] === 'sync') {
		const q = parts.slice(1).join(' ').toLowerCase();
		return sort_skills(
			mgr.discover().filter((skill) => Boolean(skill.import_meta)),
		)
			.filter(
				(s) =>
					s.key.toLowerCase().includes(q) ||
					s.name.toLowerCase().includes(q),
			)
			.slice(0, 20)
			.map((s) => ({
				value: `${parts[0]} ${s.key}`,
				label: s.key,
			}));
	}

	if (parts[0] === 'profile') {
		const profile_subs = [
			'list',
			'show',
			'use',
			'create',
			'include',
			'exclude',
		];
		if (parts.length <= 2 && !has_trailing_space) {
			return profile_subs
				.filter((s) => s.startsWith(parts[1] || ''))
				.map((s) => ({ value: `profile ${s}`, label: s }));
		}
		if (
			['show', 'use', 'include', 'exclude'].includes(parts[1] ?? '')
		) {
			const q = parts.slice(2).join(' ').toLowerCase();
			return mgr
				.list_profiles()
				.filter((profile) => profile.name.toLowerCase().includes(q))
				.slice(0, 20)
				.map((profile) => ({
					value: `profile ${parts[1]} ${profile.name}`,
					label: profile.name,
				}));
		}
	}

	return null;
}
