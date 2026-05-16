export function is_subcommand(command: string): boolean {
	return [
		'help',
		'list',
		'show',
		'clear',
		'edit',
		'edit-global',
		'export-defaults',
		'delete',
		'reset',
		'reload',
		'base',
		'enable',
		'disable',
		'toggle',
	].includes(command);
}

export function format_prompt_preset_help(): string {
	return `Prompt presets append instructions to the system prompt.

Commands:
- /prompt-preset                Open the preset picker
- /prompt-preset show           Show the active base and layers
- /prompt-preset <name>         Activate a base preset or toggle a layer
- /prompt-preset base <name>    Activate a base preset
- /prompt-preset enable <layer> Enable a layer
- /prompt-preset disable <layer> Disable a layer
- /prompt-preset edit <name>    Edit/create .pi/presets/<name>.md
- /prompt-preset edit-global <name> Edit/create ~/.pi/agent/presets/<name>.md
- /prompt-preset export-defaults Export built-ins to ~/.pi/agent/presets/*.md
- /prompt-preset export-defaults project Export built-ins to .pi/presets/*.md
- /prompt-preset reload         Reload presets after manual file edits
- /prompt-preset clear          Clear active base and layers

Examples:
- /prompt-preset export-defaults
- /prompt-preset edit-global terse
- /prompt-preset base detailed
- /prompt-preset enable bullets
- /prompt-preset show

Alias: /preset`;
}
