import {
	truncateToWidth,
	visibleWidth,
} from '@earendil-works/pi-tui';
import { muted, type FooterTheme } from '../theme/tokens.js';
import { sanitize_status_text } from '../utils/text.js';

export function render_footer_status_line(
	theme: FooterTheme,
	width: number,
	left_items: string[],
	right_item?: string,
): string | undefined {
	const left = sanitize_status_text(left_items.join(' '));
	const right = right_item ? sanitize_status_text(right_item) : '';
	if (!left && !right) return undefined;
	if (!right) {
		return truncateToWidth(
			muted(theme, left),
			width,
			muted(theme, '...'),
		);
	}
	if (!left) {
		const themed_right = muted(theme, right);
		const right_width = visibleWidth(themed_right);
		return right_width >= width
			? truncateToWidth(themed_right, width, muted(theme, '...'))
			: `${' '.repeat(width - right_width)}${themed_right}`;
	}

	const right_width = visibleWidth(right);
	if (right_width >= width) {
		return truncateToWidth(
			muted(theme, right),
			width,
			muted(theme, '...'),
		);
	}

	const min_gap = 1;
	const available_left = Math.max(0, width - right_width - min_gap);
	const truncated_left = truncateToWidth(left, available_left, '...');
	const left_width = visibleWidth(truncated_left);
	const gap = Math.max(min_gap, width - left_width - right_width);
	return (
		muted(theme, truncated_left) +
		' '.repeat(gap) +
		muted(theme, right)
	);
}
