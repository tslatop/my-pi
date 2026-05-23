export type Hunk = {
	before?: string[];
	after?: string[];
	line_number?: number;
};

export type Turn =
	| { role: 'user'; text: string; delay?: number }
	| { role: 'assistant'; text: string; delay?: number }
	| {
			role: 'working';
			text?: string;
			duration?: number;
			delay?: number;
	  }
	| {
			role: 'read';
			path: string;
			range?: string;
			code: string;
			language?: string;
			lines_above?: number;
			lines_below?: number;
			total_lines?: number;
			delay?: number;
	  }
	| {
			role: 'write';
			path: string;
			code: string;
			language?: string;
			lines_above?: number;
			lines_below?: number;
			total_lines?: number;
			delay?: number;
	  }
	| {
			role: 'bash';
			command: string;
			output?: string;
			exit_code?: number;
			delay?: number;
	  }
	| { role: 'diff'; path: string; hunks: Hunk[]; delay?: number };

export type RenderedTurn = Turn & { id: string };

export type Metrics = {
	up: number;
	down: number;
	ram: number;
	cost: number;
	ctx_used: number;
	ctx_max: number;
};
