const keywords = new Set([
	'import',
	'from',
	'export',
	'const',
	'let',
	'var',
	'function',
	'return',
	'if',
	'else',
	'for',
	'while',
	'do',
	'switch',
	'case',
	'break',
	'continue',
	'class',
	'extends',
	'new',
	'this',
	'super',
	'async',
	'await',
	'try',
	'catch',
	'finally',
	'throw',
	'typeof',
	'instanceof',
	'in',
	'of',
	'void',
	'delete',
	'yield',
	'static',
	'public',
	'private',
	'protected',
	'interface',
	'implements',
	'type',
	'enum',
	'readonly',
]);

const constants = new Set([
	'null',
	'undefined',
	'true',
	'false',
	'NaN',
	'Infinity',
]);

export type Token = {
	t: 'c' | 's' | 'n' | 'k' | 'cn' | 'i' | 'o' | 'p';
	v: string;
};

export function highlight_line(line: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	while (i < line.length) {
		const rest = line.slice(i);
		const m_c = rest.match(/^\/\/.*/);
		if (m_c) {
			out.push({ t: 'c', v: m_c[0] });
			i += m_c[0].length;
			continue;
		}
		const m_s = rest.match(/^(['"`])(?:\\.|(?!\1).)*\1?/);
		if (m_s) {
			out.push({ t: 's', v: m_s[0] });
			i += m_s[0].length;
			continue;
		}
		const m_n = rest.match(/^(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)/);
		if (m_n) {
			out.push({ t: 'n', v: m_n[0] });
			i += m_n[0].length;
			continue;
		}
		const m_i = rest.match(/^[A-Za-z_$#][A-Za-z0-9_$]*/);
		if (m_i) {
			const w = m_i[0];
			if (keywords.has(w)) out.push({ t: 'k', v: w });
			else if (constants.has(w)) out.push({ t: 'cn', v: w });
			else out.push({ t: 'i', v: w });
			i += w.length;
			continue;
		}
		const m_o = rest.match(
			/^(===|!==|==|!=|=>|<=|>=|\+\+|--|&&|\|\||[=+\-*/%<>!&|^~?:])/,
		);
		if (m_o) {
			out.push({ t: 'o', v: m_o[0] });
			i += m_o[0].length;
			continue;
		}
		out.push({ t: 'p', v: line[i] });
		i += 1;
	}
	return out;
}

export function format_k(n: number) {
	if (n >= 1_000_000) {
		const v = n / 1_000_000;
		return `${v.toFixed(v < 10 ? 1 : 0)}M`;
	}
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return `${n}`;
}
