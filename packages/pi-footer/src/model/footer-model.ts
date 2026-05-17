import type {
	ExtensionContext,
	ReadonlyFooterDataProvider,
} from '@earendil-works/pi-coding-agent';
import { error, warning, type FooterTheme } from '../theme/tokens.js';
import { format_token_count } from '../utils/text.js';
import { get_current_thinking_level } from './thinking.js';

export interface FooterModel {
	pwd: string;
	stats_parts: string[];
	model_text: string;
	statuses: Map<string, string>;
	preset_status?: string;
}

export function build_footer_model(
	ctx: ExtensionContext,
	footer_data: ReadonlyFooterDataProvider,
	theme: FooterTheme,
): FooterModel {
	let total_input = 0;
	let total_output = 0;
	let total_cache_read = 0;
	let total_cache_write = 0;
	let total_cost = 0;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (
			entry.type === 'message' &&
			entry.message.role === 'assistant'
		) {
			total_input += entry.message.usage.input;
			total_output += entry.message.usage.output;
			total_cache_read += entry.message.usage.cacheRead;
			total_cache_write += entry.message.usage.cacheWrite;
			total_cost += entry.message.usage.cost.total;
		}
	}

	const context_usage = ctx.getContextUsage();
	const context_window =
		context_usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	const context_percent_value = context_usage?.percent ?? 0;
	const context_percent =
		context_usage?.percent !== null
			? context_percent_value.toFixed(1)
			: '?';

	let pwd = ctx.cwd;
	const home = process.env.HOME || process.env.USERPROFILE;
	if (home && pwd.startsWith(home)) {
		pwd = `~${pwd.slice(home.length)}`;
	}

	const branch = footer_data.getGitBranch();
	if (branch) pwd = `${pwd} (${branch})`;

	const session_name = ctx.sessionManager.getSessionName();
	if (session_name) pwd = `${pwd} • ${session_name}`;

	const stats_parts: string[] = [];
	if (total_input)
		stats_parts.push(`↑${format_token_count(total_input)}`);
	if (total_output)
		stats_parts.push(`↓${format_token_count(total_output)}`);
	if (total_cache_read)
		stats_parts.push(`R${format_token_count(total_cache_read)}`);
	if (total_cache_write)
		stats_parts.push(`W${format_token_count(total_cache_write)}`);

	const using_subscription = ctx.model
		? ctx.modelRegistry.isUsingOAuth(ctx.model)
		: false;
	if (total_cost || using_subscription) {
		stats_parts.push(
			`$${total_cost.toFixed(3)}${using_subscription ? ' (sub)' : ''}`,
		);
	}

	const context_percent_display =
		context_percent === '?'
			? `?/${format_token_count(context_window)}`
			: `${context_percent}%/${format_token_count(context_window)}`;
	let context_percent_str = context_percent_display;
	if (context_percent_value > 90) {
		context_percent_str = error(theme, context_percent_display);
	} else if (context_percent_value > 70) {
		context_percent_str = warning(theme, context_percent_display);
	}
	stats_parts.push(context_percent_str);

	const model_name = ctx.model?.id || 'no-model';
	const thinking_level = get_current_thinking_level(ctx);
	let model_text = model_name;
	if (ctx.model?.reasoning) {
		model_text =
			thinking_level === 'off'
				? `${model_name} • thinking off`
				: `${model_name} • ${thinking_level}`;
	}
	if (footer_data.getAvailableProviderCount() > 1 && ctx.model) {
		model_text = `(${ctx.model.provider}) ${model_text}`;
	}

	const statuses = new Map(footer_data.getExtensionStatuses());
	const preset_status = statuses.get('preset');
	statuses.delete('preset');

	return {
		pwd,
		stats_parts,
		model_text,
		statuses,
		preset_status,
	};
}
