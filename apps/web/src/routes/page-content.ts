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
		'A ready-to-run Pi coding-agent CLI distribution with MCP, LSP, skills, recall, redaction, telemetry, team mode, prompt presets, and project guardrails prewired.',
	],
	[
		'Is my-pi different from Pi?',
		'Yes. Pi is the underlying coding-agent SDK and CLI. my-pi is an opinionated distribution built on top of Pi.',
	],
	[
		'Can I install only part of my-pi?',
		'Yes. Most features are published as reusable @spences10/pi-* packages for vanilla Pi setups.',
	],
	[
		'Does my-pi support MCP servers?',
		'Yes. It loads stdio and HTTP MCP servers from project config and exposes them as coding-agent tools.',
	],
	[
		'Does my-pi include language-server tools?',
		'Yes. It provides diagnostics, hover, definitions, references, and document symbols through LSP tools.',
	],
	[
		'How does my-pi handle large tool output?',
		'Large command output and MCP responses are stored in a local SQLite full-text context sidecar so they stay searchable without flooding chat.',
	],
	[
		'Does my-pi help protect secrets?',
		'Yes. It includes redaction, secret-loading reminders, and confirmations for destructive commands.',
	],
	[
		'Can my-pi run multiple agents?',
		'Yes. Team mode supports local RPC teammates with tasks, mailboxes, and coordination tools.',
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
