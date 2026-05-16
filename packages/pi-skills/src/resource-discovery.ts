export function is_resource_enabled(
	value: string | undefined,
): boolean {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return true;
	return !['0', 'false', 'no', 'skip', 'disable'].includes(
		normalized,
	);
}
