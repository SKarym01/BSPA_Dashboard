/**
 * Text normalization utilities mimicking the Python 'textnorm.py'.
 * Used to standardize parameter names for fuzzy matching.
 */

// 1. Replacements / Synonyms
const REPLACEMENTS: [RegExp, string][] = [
    [/\binner\b/gi, 'in'],
    [/\bouter\b/gi, 'out'],
    [/\bdia\b/gi, 'diameter'],
    [/\bdiam\b/gi, 'diameter'],
    [/\bdiameter\b/gi, 'diameter'], // normalized later to 'len' or kept as diameter? Python maps diameter->diameter, but conflict list maps diameter->len. Let's keep consistent with python dict key.
    [/\blength\b/gi, 'len'],
    [/\bheight\b/gi, 'hgt'],
    [/\bwidth\b/gi, 'wdt'],
    [/\bfront\b/gi, 'fr'],
    [/\brear\b/gi, 'rr'],
    [/\bleft\b/gi, 'l'],
    [/\bright\b/gi, 'r'],
    [/\bcircuit\s*1\b/gi, 'c1'],
    [/\bcircuit\s*2\b/gi, 'c2'],
    [/\btime[-\s]*to[-\s]*lock\b/gi, 'ttl'],
    [/\baeb[-\s]*vru\b/gi, 'ttl'],
    [/\bvoltage\b/gi, 'u'],  // Common engineering abbr
    [/\bsupply\b/gi, 'sup'],
];

// 2. Regex patterns
const UNITS_BRACKETS_RE = /[\[\(\{]\s*[-a-zA-Z0-9/%°\s]+\s*[\]\)\}]/g;
const LEAD_DECOR_RE = /^[\u2022\-\–\—\•\*]+\s*/;
const KEEP_ALNUM_RE = /[^a-z0-9\s]+/g;
const WS_RE = /\s+/g;

const STOPWORDS = new Set([
    "the", "a", "an", "of", "for", "to", "in", "at", "on", "and", "or",
    "with", "without", "from", "by", "as", "is", "are", "be", "been",
    "being", "please", "take", "care", "check", "parameter" // 'check' and 'parameter' are often headers
]);

/**
 * Normalizes a string for matching.
 * @param input Raw string
 * @param mode 'basic' | 'strong'
 */
export function normalizeText(input: any, mode: 'basic' | 'strong' = 'strong'): string {
    if (input === null || input === undefined) return '';
    let s = String(input).trim();
    if (!s) return '';

    // Remove leading bullets
    s = s.replace(LEAD_DECOR_RE, '');
    s = s.toLowerCase();

    // Standardize separators
    s = s.replace(/[\/\-_]/g, ' ');

    // Remove units [mm], (V), etc.
    s = s.replace(UNITS_BRACKETS_RE, ' ');

    // Remove special chars (keep only alphanumeric and spaces)
    s = s.replace(KEEP_ALNUM_RE, ' ');

    // Collapse whitespace
    s = s.replace(WS_RE, ' ').trim();

    if (mode === 'basic') return s;

    // Apply Replacements
    REPLACEMENTS.forEach(([pat, repl]) => {
        s = s.replace(pat, repl);
    });

    if (mode === 'strong') {
        // Tokenize and remove stopwords
        const tokens = s.split(' ').filter(t => !STOPWORDS.has(t) && t.length > 0);
        return tokens.join(' ');
    }

    return s;
}

/**
 * Basic fuzzy match score (0-100) based on Token Set Ratio logic.
 * (Does string A contain tokens of string B?)
 */
export function tokenSetRatio(str1: string, str2: string): number {
    const s1 = normalizeText(str1, 'strong');
    const s2 = normalizeText(str2, 'strong');

    if (!s1 || !s2) return 0;

    const t1 = new Set(s1.split(' '));
    const t2 = new Set(s2.split(' '));

    // Intersection
    const intersection = new Set([...t1].filter(x => t2.has(x)));

    // Sort strings for consistent ratio calculation: intersection vs intersection+remainder
    // Simplified logic: how much of the smaller set is in the larger set?
    // Actually rapidfuzz is more complex. Let's do a simple Jaccard-ish or overlap coefficient.

    // Better heuristic for this use case:
    // If the *Target Parameter* tokens are found in the *Cell Value*, it's a match.
    // We care if the Cell Label "Voltage Supply (Modulation)" matches Target "Voltage Supply for Modulation".

    const intersectionCount = intersection.size;
    const unionCount = new Set([...t1, ...t2]).size;

    // Classic Jaccard
    // return (intersectionCount / unionCount) * 100;

    // For parameter matching, we often want "Contains":
    // If t1 (target) is a subset of t2 (cell), that's good.
    // But sometimes cell is "V_Sup_Mod" and target is "Voltage Supply Modulation".

    // Let's use numeric average of overlap relative to lengths
    const score1 = intersectionCount / t1.size;
    const score2 = intersectionCount / t2.size;

    return ((score1 + score2) / 2) * 100;
}
