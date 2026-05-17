export interface FooterReference {
	name: string;
	package_name?: string;
	takeaways: string[];
}

export const FOOTER_RESEARCH_REFERENCES: FooterReference[] = [
	{
		name: 'pi-footer',
		package_name: 'pi-footer',
		takeaways: [
			'Config UI with live preview',
			'Preset and widget model',
			'Persisted footer configuration',
		],
	},
	{
		name: 'pi-powerline-footer',
		package_name: 'pi-powerline-footer',
		takeaways: [
			'Color-coded segment system',
			'Git and context warning priority',
			'Opinionated powerline presets',
		],
	},
	{
		name: '@feniix/pi-statusline',
		package_name: '@feniix/pi-statusline',
		takeaways: [
			'Fixed two-line statusline',
			'Activity, skill, and worktree indicators',
		],
	},
	{
		name: '@sentiolabs/pi-scriptable-statusline',
		package_name: '@sentiolabs/pi-scriptable-statusline',
		takeaways: [
			'User-owned renderer file',
			'Reload and doctor commands',
		],
	},
	{
		name: '@ogulcancelik/pi-minimal-footer',
		package_name: '@ogulcancelik/pi-minimal-footer',
		takeaways: [
			'Usage and quota bars',
			'Compact git branch/dirty/ahead/behind display',
		],
	},
	{
		name: 'pi-ui-minimal',
		package_name: 'pi-ui-minimal',
		takeaways: ['Minimal/focus mode for low-noise sessions'],
	},
];
