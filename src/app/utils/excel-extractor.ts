import { normalizeText, tokenSetRatio } from './text-norm';
import { ParameterGroup, ParameterRow } from '../services/data.service';
import { utils } from 'xlsx';

export interface ExtractedValue {
    paramId: string;
    originalName: string;
    foundValue: any;
    confidence: number; // 0-100
    sourceCell: string; // e.g., "A5"
}
export interface ExtractedRowValues {
    paramId: string;
    originalName: string;
    values: { col: number; value: any }[];
    confidence: number;
    labelRow: number;
    labelCol: number;
}

/**
 * Robustly extracts parameters from a sheet 2D array.
 */
export class ExcelExtractor {

    private rawData: any[][];
    private static readonly MIN_MATCH_SCORE = 88;
    private static readonly MAX_LABEL_CHARS = 80;
    private static readonly MAX_LABEL_TOKENS = 10;
    private static readonly VARIANT_HEADER_MATCH = 85;
    private static readonly GARBAGE_LABELS = new Set([
        'parameter', 'parameters', 'unit', 'units', 'comment', 'comments',
        'check', 'status', 'project', 'customer', 'description', 'variant',
        'value', 'werte', 'wert'
    ]);
    private static readonly PARAM_TOKENS = ['parametercheck', 'parameter check', 'parameter', 'param', 'check'];
    private static readonly COMMENT_TOKENS = ['free text', 'free-text', 'freetext', 'comment', 'comments', 'kommentar', 'bemerkung'];
    private static readonly UNIT_TOKENS = ['unit', 'units'];

    constructor(rawData: any[][]) {
        this.rawData = rawData;
    }

    /**
     * Main entry point: Extracts all parameters defined in the groups.
     */
    public extractAllParameters(groups: ParameterGroup[]): ExtractedValue[] {
        const results: ExtractedValue[] = [];

        // Flatten all parameters we are looking for
        const allParams: ParameterRow[] = groups.flatMap(g => g.parameters);

        allParams.forEach(param => {
            const match = this.findBestMatch(param.name, param.id);
            if (match) {
                results.push({
                    paramId: param.id,
                    originalName: param.name,
                    foundValue: match.value,
                    confidence: match.score,
                    sourceCell: `R${match.r + 1}C${match.c + 1}`
                });
            }
        });

        return results;
    }

    /**
     * Extracts values across columns (variants) for each parameter.
     * Returns all right-side values on the matched label row.
     */
    public extractAllParametersWithColumns(groups: ParameterGroup[]): ExtractedRowValues[] {
        const results: ExtractedRowValues[] = [];
        const allParams: ParameterRow[] = groups.flatMap(g => g.parameters);

        allParams.forEach(param => {
            const label = this.findBestLabelCell(param.name, param.id);
            if (!label) return;
            const values = this.extractRowValues(label.r, label.c);
            if (values.length === 0) return;
            results.push({
                paramId: param.id,
                originalName: param.name,
                values,
                confidence: label.score,
                labelRow: label.r,
                labelCol: label.c
            });
        });

        return results;
    }

    /**
     * Strategy:
     * 1. Scan the grid for labels matching the parameter name (fuzzy).
     * 2. If a label is found, look for values in:
     *    - Cell to the Right (c+1)
     *    - Cell Below (r+1)
     *    - Merged cells logic (approximated by checking valid neighbors)
     * 3. Pick the match with highest text similarity score.
     */
    private findBestMatch(targetNum: string, targetId: string): { value: any, score: number, r: number, c: number } | null {
        let bestMatch = null;
        let bestScore = 0;
        const normTarget = normalizeText(targetNum, 'strong');
        if (!normTarget || normTarget.length < 3) return null;

        // Optimization: We could build an index of the grid strings first, but grid is usually small enough (< 500 rows).
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r];
            for (let c = 0; c < row.length; c++) {
                const cellVal = row[c];
                if (!cellVal) continue;

                const cellStr = String(cellVal);
                if (!this.isLikelyLabel(cellStr)) continue;

                // Calculate Score
                const score = this.calculateMatchScore(targetNum, targetId, cellStr);

                if (score >= ExcelExtractor.MIN_MATCH_SCORE && score > bestScore) {
                    // We found a potential label. Now find the value.
                    const value = this.extractValueForLabel(r, c);

                    if (this.isLikelyValue(value)) {
                        bestScore = score;
                        bestMatch = { value, score, r, c };
                    }
                }
            }
        }

        return bestMatch;
    }

    private findBestLabelCell(targetNum: string, targetId: string): { score: number, r: number, c: number } | null {
        let best = null;
        let bestScore = 0;
        const normTarget = normalizeText(targetNum, 'strong');
        if (!normTarget || normTarget.length < 3) return null;

        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r];
            for (let c = 0; c < row.length; c++) {
                const cellVal = row[c];
                if (!cellVal) continue;
                const cellStr = String(cellVal);
                if (!this.isLikelyLabel(cellStr)) continue;
                const score = this.calculateMatchScore(targetNum, targetId, cellStr);
                if (score >= ExcelExtractor.MIN_MATCH_SCORE && score > bestScore) {
                    bestScore = score;
                    best = { score, r, c };
                }
            }
        }

        return best;
    }

    private extractRowValues(r: number, c: number): { col: number; value: any }[] {
        const row = this.rawData[r] || [];
        const values: { col: number; value: any }[] = [];
        let emptyStreak = 0;

        for (let col = c + 1; col < row.length; col++) {
            const val = row[col];
            if (this.isLikelyValue(val)) {
                values.push({ col, value: val });
                emptyStreak = 0;
                continue;
            }
            if (val === undefined || val === null || String(val).trim() === '') {
                emptyStreak += 1;
            } else {
                emptyStreak += 1;
            }
            if (emptyStreak >= 3) break;
        }

        return values;
    }

    public getColumnHeader(col: number, startRow: number): string {
        for (let r = startRow - 1; r >= 0 && r >= startRow - 3; r--) {
            const row = this.rawData[r];
            if (!row) continue;
            const val = row[col];
            if (this.isLikelyLabel(val)) return String(val).trim();
        }
        return '';
    }

    private calculateMatchScore(targetName: string, targetId: string, cellText: string): number {
        // 1. Direct ID match (e.g. "P1_1")
        if (targetId && cellText.toLowerCase().includes(targetId.toLowerCase())) {
            return 100;
        }

        // 2. Exact normalized match
        const normTarget = normalizeText(targetName, 'strong');
        const normCell = normalizeText(cellText, 'strong');

        if (normCell === normTarget) return 100;

        // 3. Fuzzy Token Match
        return tokenSetRatio(targetName, cellText);
    }

    private extractValueForLabel(r: number, c: number): any {
        const row = this.rawData[r];
        const nextRow = this.rawData[r + 1];

        // Strategy 1: Right (c+1)
        const valRight = row[c + 1];
        if (this.isLikelyValue(valRight)) return valRight;

        // Strategy 2: Right + 1 (c+2) - sometimes there's a unit column in between
        const valRight2 = row[c + 2];
        if (this.isLikelyValue(valRight2)) return valRight2;

        // Strategy 3: Below (r+1, c)
        if (nextRow) {
            const valBelow = nextRow[c];
            if (this.isLikelyValue(valBelow)) return valBelow;
        }

        return null;
    }

    /**
     * Auto-discovers parameter groups and structure from the Excel sheet.
     * Heuristics:
     * 1. Detects potential signatures of a "Group Header" (e.g., "1. Vehicle Data", Bold text, or text with no value neighbors).
     * 2. Detects potential "Parameters" (Rows with Name | Value pattern).
     */
    public discoverParameterGroups(): ParameterGroup[] {
        const groups: ParameterGroup[] = [];
        let currentGroup: ParameterGroup = { groupName: 'General Parameters', parameters: [] };

        // Helper to check if a row is likely a header
        // A header usually has text in the first significant column, and EMPTY cells next to it.
        const isHeader = (r: number, cStart: number, text: string): boolean => {
            const row = this.rawData[r];
            // Check next 3 columns are empty
            const hasValueNeighbor = (row[cStart + 1] || row[cStart + 2] || row[cStart + 3]);
            // Headers often start with a number (e.g., "1.", "2.1") or are uppercase
            const isNumbered = /^\d+(\.\d+)*\.?\s/.test(text);
            const norm = normalizeText(text, 'strong');
            const tooLong = text.length > ExcelExtractor.MAX_LABEL_CHARS || norm.split(' ').length > ExcelExtractor.MAX_LABEL_TOKENS;
            return !hasValueNeighbor && !tooLong && (isNumbered || text.length < 50); // Loose heuristic
        };

        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r];
            if (!row || row.length === 0) continue;

            const cFirst = row.findIndex(cell => this.isLikelyLabel(cell));
            if (cFirst === -1) continue; // Empty row

            const text = String(row[cFirst]).trim();
            const val = this.extractValueForLabel(r, cFirst);

            // CASE 1: New Group Header?
            // If it has NO value, and looks like a title
            if (!val && isHeader(r, cFirst, text)) {
                // Convert current group to saved if valid
                if (currentGroup.parameters.length > 0) {
                    groups.push(currentGroup);
                }
                // Start new group
                currentGroup = {
                    groupName: text,
                    parameters: []
                };
                continue;
            }

            // CASE 2: Parameter Row?
            // If it HAS a value (or looks like a parameter slot)
            if (this.isLikelyValue(val)) {
                // Try to detect Unit (often between Name and Value)
                let unit = '';
                // Heuristic: if value was found at cFirst+2, maybe cFirst+1 is unit?
                const cVal = row.indexOf(val, cFirst + 1);
                if (cVal > cFirst + 1) {
                    unit = String(row[cFirst + 1] || '').trim();
                }

                currentGroup.parameters.push({
                    id: this.generateId(text),
                    name: text,
                    unit: unit,
                    type: typeof val === 'number' ? 'number' : 'text',
                    defaultValue: val,
                    userComment: '',
                    checkStatus: ''
                });
                continue;
            }
        }

        // Push last group
        if (currentGroup.parameters.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    private isLikelyLabel(val: any): boolean {
        if (!val) return false;
        const text = String(val).trim();
        if (text.length < 2) return false;
        if (text.length > ExcelExtractor.MAX_LABEL_CHARS) return false;
        const norm = normalizeText(text, 'strong');
        if (!norm || norm.length < 2) return false;
        if (/^[0-9\.\-_/]+$/.test(text)) return false;
        const tokens = norm.split(' ').filter(Boolean);
        if (tokens.length > ExcelExtractor.MAX_LABEL_TOKENS) return false;
        const letters = (text.match(/[a-zA-Z]/g) || []).length;
        if (letters < 2) return false;
        if (ExcelExtractor.GARBAGE_LABELS.has(norm)) return false;
        return true;
    }

    private generateId(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) + '_' + Math.floor(Math.random() * 1000);
    }

    private isLikelyValue(val: any): boolean {
        if (val === undefined || val === null) return false;
        if (typeof val === 'number' || typeof val === 'boolean') return true;
        const s = String(val).trim();
        if (!s) return false;
        const lower = s.toLowerCase();
        if (['-', 'n/a', 'na', 'none', 'tbd'].includes(lower)) return false;
        // Reject long label-like strings
        if (s.length > 60) return false;
        const norm = normalizeText(s, 'strong');
        const tokenCount = norm ? norm.split(' ').length : 0;
        if (tokenCount > 8) return false;
        // If it looks like a label and is long, treat as not a value
        if (this.isLikelyLabel(s) && s.length > 18) return false;
        return true;
    }

    /**
     * === Matrix-based parsing (variants as columns, parameters as rows) ===
     * Mirrors the Python agent logic: find "Customer Platform Variants",
     * anchor matrix header by variant names, then read values below.
     */
    public parseMatrixFromSheet(): { parameterGroups: ParameterGroup[]; variants: { id: string; name: string; values: Record<string, any> }[] } | null {
        const variantNames = this.extractVariantNames();
        const header = variantNames.length > 0 ? this.findMatrixHeaderRow(variantNames) : this.findHeaderRowByTokens();
        if (!header) return null;

        const { headerRow, colMap, paramCol, commentCol, checkCol, unitCol } = header;
        const groups: ParameterGroup[] = [];
        let currentGroup: ParameterGroup = { groupName: 'General Parameters', parameters: [] };

        for (let r = headerRow + 1; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            if (this.isCategoryRow(row)) {
                const name = String(row[this.firstNonEmptyCol(row)]).trim();
                if (currentGroup.parameters.length > 0) groups.push(currentGroup);
                currentGroup = { groupName: name, parameters: [] };
                continue;
            }
            let paramName = '';
            if (paramCol !== null && paramCol !== undefined && paramCol < row.length) {
                const v = row[paramCol];
                if (this.isLikelyLabel(v)) paramName = String(v).trim();
            }
            if (!paramName) {
                for (let c = 0; c < Math.min(3, row.length); c++) {
                    const v = row[c];
                    if (this.isLikelyLabel(v)) {
                        paramName = String(v).trim();
                        break;
                    }
                }
            }
            if (!paramName) continue;
            const norm = normalizeText(paramName, 'strong');
            if (!norm || ExcelExtractor.GARBAGE_LABELS.has(norm)) continue;

            const unit = this.cellToString(row, unitCol);
            const comment = this.cellToString(row, commentCol);
            const check = this.normalizeCheckStatus(this.cellToString(row, checkCol));

            currentGroup.parameters.push({
                id: this.generateId(paramName),
                name: paramName,
                unit: unit || '',
                type: 'text',
                userComment: comment || '',
                checkStatus: check
            });
        }

        if (currentGroup.parameters.length > 0) groups.push(currentGroup);

        const variants: { id: string; name: string; values: Record<string, any> }[] = Object.entries(colMap)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([colStr, name], idx) => ({
                id: `v${idx + 1}`,
                name,
                values: {} as Record<string, any>
            }));

        // Fill values
        const colEntries = Object.entries(colMap).map(([k, v]) => ({ col: Number(k), name: v }));
        for (let r = headerRow + 1; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            let paramName = '';
            if (paramCol !== null && paramCol !== undefined && paramCol < row.length) {
                const v = row[paramCol];
                if (this.isLikelyLabel(v)) paramName = String(v).trim();
            }
            if (!paramName) {
                for (let c = 0; c < Math.min(3, row.length); c++) {
                    const v = row[c];
                    if (this.isLikelyLabel(v)) {
                        paramName = String(v).trim();
                        break;
                    }
                }
            }
            if (!paramName) continue;
            const param = groups.flatMap(g => g.parameters).find(p => p.name === paramName);
            if (!param) continue;

            colEntries.forEach((ce, i) => {
                const v = row[ce.col];
                if (this.isLikelyValue(v)) {
                    variants[i].values[param.id] = v;
                }
            });
        }

        return { parameterGroups: groups, variants };
    }

    private isCategoryRow(row: any[]): boolean {
        const nonEmptyIdx = this.firstNonEmptyCol(row);
        if (nonEmptyIdx === -1) return false;
        const label = row[nonEmptyIdx];
        if (!this.isLikelyLabel(label)) return false;
        // category row: only one non-empty cell in the row
        for (let c = 0; c < row.length; c++) {
            if (c === nonEmptyIdx) continue;
            const v = row[c];
            if (v !== undefined && v !== null && String(v).trim() !== '') return false;
        }
        return true;
    }

    private firstNonEmptyCol(row: any[]): number {
        for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v !== undefined && v !== null && String(v).trim() !== '') return c;
        }
        return -1;
    }

    private extractVariantNames(): string[] {
        let startRow = -1;
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v) continue;
                const s = normalizeText(String(v), 'strong');
                if (s === 'customer platform variants') {
                    startRow = r;
                    break;
                }
            }
            if (startRow >= 0) break;
        }

        if (startRow < 0) return [];

        let headerRow = -1;
        let nameCol = -1;
        for (let r = startRow; r < Math.min(startRow + 12, this.rawData.length); r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v) continue;
                const s = normalizeText(String(v), 'strong');
                if (s === 'name') {
                    headerRow = r;
                    nameCol = c;
                    break;
                }
            }
            if (headerRow >= 0) break;
        }

        if (headerRow < 0 || nameCol < 0) return [];

        const variants: string[] = [];
        for (let r = headerRow + 1; r < Math.min(headerRow + 160, this.rawData.length); r++) {
            const row = this.rawData[r] || [];
            const v = row[nameCol];
            if (!v) break;
            const name = String(v).trim();
            if (!name) break;
            if (normalizeText(name, 'strong').includes('attention')) break;
            variants.push(name);
        }
        return variants;
    }

    private findMatrixHeaderRow(variants: string[]): { headerRow: number; colMap: { [col: number]: string }; paramCol: number | null; commentCol: number | null; checkCol: number | null; unitCol: number | null } | null {
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            let matches = 0;
            const colMap: { [col: number]: string } = {};
            let paramCol: number | null = null;
            let commentCol: number | null = null;
            let checkCol: number | null = null;
            let unitCol: number | null = null;
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v) continue;
                const cell = String(v).trim();
                if (!cell) continue;
                const cellNorm = normalizeText(cell, 'strong');
                if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) {
                    paramCol = c;
                    checkCol = c; // some sheets use "Parametercheck" as check column
                    continue;
                }
                if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) {
                    commentCol = c;
                    continue;
                }
                if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) {
                    unitCol = c;
                    continue;
                }
                for (const vn of variants) {
                    const sc = tokenSetRatio(cell, vn);
                    if (sc >= ExcelExtractor.VARIANT_HEADER_MATCH) {
                        matches += 1;
                        colMap[c] = vn;
                        break;
                    }
                }
            }
            if (matches > 0 && matches >= Math.max(1, Math.floor(variants.length * 0.5))) {
                return { headerRow: r, colMap, paramCol, commentCol, checkCol, unitCol };
            }
        }
        return null;
    }

    private findHeaderRowByTokens(): { headerRow: number; colMap: { [col: number]: string }; paramCol: number | null; commentCol: number | null; checkCol: number | null; unitCol: number | null } | null {
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            let paramCol: number | null = null;
            let commentCol: number | null = null;
            let checkCol: number | null = null;
            let unitCol: number | null = null;
            const colMap: { [col: number]: string } = {};

            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v) continue;
                const cell = String(v).trim();
                if (!cell) continue;
                const cellNorm = normalizeText(cell, 'strong');
                if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) {
                    paramCol = c;
                    checkCol = c;
                    continue;
                }
                if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) {
                    commentCol = c;
                    continue;
                }
                if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) {
                    unitCol = c;
                    continue;
                }
            }

            if (paramCol === null || commentCol === null) continue;

            const startCol = Math.max(paramCol, commentCol, unitCol ?? -1, checkCol ?? -1) + 1;
            let found = 0;
            let emptyStreak = 0;
            for (let c = startCol; c < row.length; c++) {
                const cell = this.getHeaderCellValue(r, c, paramCol, true);
                if (!cell) continue;
                const cellNorm = normalizeText(cell, 'strong');
                if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) continue;
                if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) continue;
                if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) continue;
                if (ExcelExtractor.GARBAGE_LABELS.has(cellNorm)) continue;
                colMap[c] = cell;
                found += 1;
                emptyStreak = 0;
                if (found >= 7) break;
            }

            if (found < 7) {
                for (let c = startCol; c < row.length; c++) {
                    if (colMap[c]) continue;
                    const cell = this.getHeaderCellValue(r, c, paramCol, false);
                    if (!cell) {
                        emptyStreak += 1;
                        if (emptyStreak >= 5) break;
                        continue;
                    }
                    const cellNorm = normalizeText(cell, 'strong');
                    if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) continue;
                    if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) continue;
                    if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) continue;
                    if (ExcelExtractor.GARBAGE_LABELS.has(cellNorm)) continue;
                    colMap[c] = cell;
                    found += 1;
                    if (found >= 7) break;
                }
            }

            if (Object.keys(colMap).length >= 1) {
                return { headerRow: r, colMap, paramCol, commentCol, checkCol, unitCol };
            }
        }
        return null;
    }

    private getHeaderCellValue(rowIndex: number, colIndex: number, paramCol: number | null, preferBelow: boolean): string {
        const primaryRow = preferBelow ? rowIndex + 1 : rowIndex;
        const secondaryRow = preferBelow ? rowIndex : rowIndex + 1;

        const v1 = this.rawData[primaryRow]?.[colIndex];
        if (v1 !== undefined && v1 !== null && String(v1).trim() !== '') {
            return String(v1).trim();
        }
        const v0 = this.rawData[secondaryRow]?.[colIndex];
        if (v0 !== undefined && v0 !== null && String(v0).trim() !== '') {
            return String(v0).trim();
        }
        return '';
    }

    private tokenMatches(norm: string, tokens: string[]): boolean {
        return tokens.some(t => norm === normalizeText(t, 'strong') || norm.includes(normalizeText(t, 'strong')));
    }

    private cellToString(row: any[], col: number | null | undefined): string {
        if (col === null || col === undefined) return '';
        const v = row[col];
        if (v === undefined || v === null) return '';
        return String(v).trim();
    }

    private normalizeCheckStatus(value: string): any {
        const v = normalizeText(value, 'strong');
        if (!v) return '';
        if (v === 'ok') return 'ok';
        if (v === 'nok' || v === 'not ok' || v === 'notok') return 'nok';
        if (v === 'na' || v === 'n a' || v === 'n/a') return 'na';
        return '';
    }
}
