import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import {
	show_picker_modal,
	show_text_modal,
} from '@spences10/pi-tui-modal';
import type { ManagedSkill, SkillsManager } from '../manager.js';
import {
	find_skill,
	format_skill_detail,
	skill_status,
	sort_skills,
} from '../skill-utils.js';

export async function pick_skill(
	ctx: ExtensionCommandContext,
	options: {
		title: string;
		subtitle: string;
		skills: ManagedSkill[];
		empty_message: string;
	},
): Promise<string | undefined> {
	return await show_picker_modal(ctx, {
		title: options.title,
		subtitle: options.subtitle,
		items: options.skills.map((skill) => ({
			value: skill.key,
			label: skill.name,
			description: `${skill_status(skill)} • ${skill.source} • ${skill.key}`,
		})),
		empty_message: options.empty_message,
	});
}

export async function show_skill_detail_modal(
	ctx: ExtensionCommandContext,
	skill: ManagedSkill,
): Promise<void> {
	await show_text_modal(ctx, {
		title: skill.name,
		subtitle: `${skill_status(skill)} • ${skill.source}`,
		text: format_skill_detail(skill),
	});
}

export async function show_skill_list_modal(
	ctx: ExtensionCommandContext,
	mgr: SkillsManager,
): Promise<void> {
	while (true) {
		const skills = sort_skills(mgr.discover());
		const key = await pick_skill(ctx, {
			title: 'Browse skills',
			subtitle: `${skills.length} managed`,
			skills,
			empty_message: 'No skills found',
		});
		if (!key) return;
		await show_skill_detail_modal(ctx, find_skill(skills, key));
	}
}
