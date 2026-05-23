let next_request_id = 1;

export function next_rpc_request_id(): string {
	return `team-rpc-${next_request_id++}`;
}

export function json_line(value: unknown): string {
	return `${JSON.stringify(value)}\n`;
}

export function normalize_member_name(value: string): string {
	const trimmed = value.trim();
	if (
		!trimmed ||
		trimmed === '.' ||
		trimmed === '..' ||
		!/^[a-zA-Z0-9_.-]+$/.test(trimmed)
	) {
		throw new Error(
			'member must contain only letters, numbers, dots, underscores, and hyphens',
		);
	}
	return trimmed;
}
