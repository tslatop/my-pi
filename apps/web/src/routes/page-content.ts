import type { SchemaOrgProps, SeoConfig } from 'svead';

export const seo_config: SeoConfig = {
	title: 'My-Pi',
	description:
		'A ready-to-run Pi coding-agent CLI distribution with MCP integration, LSP tools, agent skills, searchable context, recall, redaction, telemetry, and team mode.',
	url: 'https://github.com/spences10/my-pi',
	website: 'github.com/spences10/my-pi',
	site_name: 'My-Pi',
	twitter_card_type: 'summary',
};

export const logo_lines = [
	'███╗   ███╗                  ██████╗ ██╗',
	'████╗ ████║ ██╗   ██╗        ██╔══██╗   ',
	'██╔████╔██║ ╚██╗ ██╔╝ ████╗  ██████╔╝██╗',
	'██║╚██╔╝██║  ╚████╔╝ ╚═══╝   ██╔═══╝ ██║',
	'██║ ╚═╝ ██║   ╚██╔╝          ██║     ██║',
	'╚═╝     ╚═╝   ██╔╝           ╚═╝     ╚═╝',
] as const;

export const faq_lines = [
	[
		'What is my-pi?',
		'my-pi is a ready-to-run Pi coding-agent distribution for terminal-first development. It bundles the Pi CLI and SDK with MCP integration, LSP tools, skills, recall, redaction, telemetry, prompt presets, team mode, and project guardrails so you can start with a complete agent workflow instead of wiring every extension by hand.',
	],
	[
		'Is my-pi different from Pi?',
		'Yes. Pi is the underlying coding-agent CLI and SDK. my-pi is an opinionated layer on top: it chooses defaults, preloads useful extensions, and publishes the same building blocks as reusable @spences10/pi-* packages for people who prefer to assemble their own setup.',
	],
	[
		'Can I install only part of my-pi?',
		'Yes. Most features are available as standalone packages. You can run the full distro with pnpx my-pi@latest, or install focused pieces such as @spences10/pi-lsp, @spences10/pi-mcp, @spences10/pi-context, or @spences10/pi-team-mode into an existing Pi installation.',
	],
	[
		'Does my-pi support MCP servers?',
		'Yes. It loads stdio and HTTP MCP servers from project configuration, then exposes those tools to the agent in the active workspace. That lets you add search, browser automation, SQLite inspection, custom internal tools, and other MCP capabilities without hardcoding them into the distro.',
	],
	[
		'Does my-pi include language-server tools?',
		'Yes. The LSP extension gives agents diagnostics, hover information, definitions, references, and document symbols through project language servers. The goal is safer edits: agents can inspect types and file-level errors before reporting that work is complete.',
	],
	[
		'How does my-pi handle large tool output?',
		'Large command output and MCP responses can be indexed into a local SQLite context sidecar. Instead of flooding the active conversation, the output stays searchable and retrievable by chunk, which keeps long coding sessions usable while preserving access to detailed logs.',
	],
	[
		'Does my-pi help protect secrets?',
		'Yes. my-pi includes output redaction, reminders to use secret-safe loading, and prompts around risky workflows. It is designed to steer agents away from pasting credentials into conversation context and toward tools that expose key names and command results without revealing secret values.',
	],
	[
		'Can my-pi run multiple agents?',
		'Yes. Team mode can coordinate local RPC teammates with tasks, mailboxes, status, and optional worktrees. It is built for longer coding jobs where one lead session delegates research, review, tests, or implementation without losing track of what each teammate is doing.',
	],
] as const;

export const page_schema: SchemaOrgProps['schema'] = [
	{
		'@type': 'SoftwareApplication',
		name: 'my-pi',
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Linux, macOS, Windows',
		description:
			'Pi coding-agent CLI distribution with MCP integration, LSP tools, agent skills, searchable context, recall, redaction, telemetry, and team mode.',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD',
		},
	},
	{
		'@type': 'SoftwareSourceCode',
		name: 'my-pi source code',
		codeRepository: 'https://github.com/spences10/my-pi',
		programmingLanguage: 'TypeScript',
		runtimePlatform: 'Node.js',
		description:
			'Source code for the my-pi Pi coding-agent CLI distribution and reusable Pi packages.',
	},
	{
		'@type': 'WebSite',
		name: 'my-pi',
		url: 'https://github.com/spences10/my-pi',
		description:
			'Landing page for discovering my-pi, a ready-to-run Pi coding-agent CLI distribution and reusable Pi packages.',
	},
	{
		'@type': 'FAQPage',
		mainEntity: faq_lines.map(([question, answer]) => ({
			'@type': 'Question',
			name: question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: answer,
			},
		})),
	},
];

export const detail_lines = [
	[
		'Pi coding-agent CLI',
		'A ready-to-run Pi distribution for terminal coding workflows, with TUI, print mode, JSON events, RPC mode, and SDK wiring included.',
	],
	[
		'MCP integration',
		'Connect stdio and HTTP MCP servers from project config so coding agents can use search, databases, browsers, and custom developer tools.',
	],
	[
		'LSP agent tools',
		'Expose language-server diagnostics, hover, definitions, references, and document symbols directly to the agent for safer code edits.',
	],
	[
		'Searchable context sidecar',
		'Keep oversized command output and MCP responses in local SQLite full-text search instead of flooding the active conversation.',
	],
	[
		'Secret and command guardrails',
		'Add redaction, secret-loading reminders, destructive-command confirmations, and configurable coding preferences to reduce risky agent behavior.',
	],
	[
		'Skills, recall, and team mode',
		'Use project-aware agent skills, previous-session recall, local telemetry, and RPC teammate orchestration for longer coding tasks.',
	],
] as const;

export const compose_lines = [
	[
		'Full distribution',
		'Run my-pi when you want the complete opinionated agent stack prewired.',
		'pnpx my-pi@latest',
	],
	[
		'Select packages',
		'Install only the extensions your existing Pi setup needs, from LSP to MCP to team mode.',
		'pi install npm:@spences10/pi-lsp',
	],
	[
		'Project tools',
		'Layer MCP servers, project-aware skills, prompt presets, and local context per workspace.',
		'mcp.json + .pi/presets.json',
	],
] as const;

export const package_lines = [
	'context',
	'lsp',
	'mcp',
	'redact',
	'recall',
	'skills',
	'team-mode',
	'telemetry',
] as const;

export const safety_lines = [
	[
		'Local-first context',
		'Oversized output lands in a searchable SQLite sidecar instead of bloating the active prompt.',
	],
	[
		'Secret-aware workflows',
		'Redaction and nopeek reminders keep credentials out of model-visible logs where possible.',
	],
	[
		'Destructive-action friction',
		'Confirmations and coding preferences add review points before risky edits or commands.',
	],
] as const;
