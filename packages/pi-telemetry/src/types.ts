import type { TelemetryDatabase } from './db.js';

export interface TelemetryStore {
	insert_run: TelemetryDatabase['insert_run'];
	finish_run: TelemetryDatabase['finish_run'];
	insert_turn: TelemetryDatabase['insert_turn'];
	finish_turn: TelemetryDatabase['finish_turn'];
	insert_tool_call: TelemetryDatabase['insert_tool_call'];
	note_tool_update: TelemetryDatabase['note_tool_update'];
	finish_tool_call: TelemetryDatabase['finish_tool_call'];
	insert_provider_request: TelemetryDatabase['insert_provider_request'];
	finish_provider_request: TelemetryDatabase['finish_provider_request'];
	get_stats: TelemetryDatabase['get_stats'];
	query_runs: TelemetryDatabase['query_runs'];
	close: TelemetryDatabase['close'];
}

export interface CreateTelemetryExtensionOptions {
	enabled?: boolean;
	db_path?: string;
	cwd?: string;
	load_store?: (db_path: string) => Promise<TelemetryStore>;
	now?: () => number;
}

export interface EvalMetadata {
	run_id: string | null;
	case_id: string | null;
	attempt: number | null;
	suite: string | null;
}

export interface ActiveRun {
	id: string;
}

export interface ActiveTurn {
	id: string;
}
