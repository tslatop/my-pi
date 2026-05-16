import type { ModalTheme } from '@spences10/pi-tui-modal';
import type {
	DiffView,
	GitFile,
	GitStatus,
	RepoOverview,
} from './git.js';

export interface ActionItem {
	action_label: string;
	action_description: string;
	run: () => void;
}

export interface StageRenderState {
	theme: ModalTheme;
	status: GitStatus;
	message: string;
	busy: boolean;
	visible_files: GitFile[];
	selected: number;
	diff?: DiffView;
	diff_for_path: string;
	diff_scroll: number;
	selected_hunk: number;
	selected_line_index?: number;
	actions?: ActionItem[];
	selected_action: number;
	repo_overview?: RepoOverview;
	show_help: boolean;
}
