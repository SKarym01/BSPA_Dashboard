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

/**
 * Robustly extracts parameters from a sheet 2D array.
 */
export class ExcelExtractor {

    private rawData: any[][];

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

        // Optimization: We could build an index of the grid strings first, but grid is usually small enough (< 500 rows).
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r];
            for (let c = 0; c < row.length; c++) {
                const cellVal = row[c];
                if (!cellVal) continue;

                const cellStr = String(cellVal);

                // Calculate Score
                const score = this.calculateMatchScore(targetNum, targetId, cellStr);

                if (score > 80 && score > bestScore) {
                    // We found a potential label. Now find the value.
                    const value = this.extractValueForLabel(r, c);

                    if (value !== undefined && value !== null && String(value).trim() !== '') {
                        bestScore = score;
                        bestMatch = { value, score, r, c };
                    }
                }
            }
        }

        return bestMatch;
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
        if (this.isValidValue(valRight)) return valRight;

        // Strategy 2: Right + 1 (c+2) - sometimes there's a unit column in between
        const valRight2 = row[c + 2];
        if (this.isValidValue(valRight2)) return valRight2;

        // Strategy 3: Below (r+1, c)
        if (nextRow) {
            const valBelow = nextRow[c];
            if (this.isValidValue(valBelow)) return valBelow;
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
            return !hasValueNeighbor && (isNumbered || text.length < 50); // Loose heuristic
        };

        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r];
            if (!row || row.length === 0) continue;

            const cFirst = row.findIndex(cell => this.isValidText(cell));
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
            if (typeof val === 'number' || (typeof val === 'string' && val.length < 50)) {
                // Try to detect Unit (often between Name and Value OR after Value)
                let unit = '';

                // Case A: Unit is between Name and Value (Name | Unit | Value)
                // If val was found at cFirst+2, check cFirst+1 for unit
                const cVal = row.indexOf(val, cFirst + 1);
                if (cVal > cFirst + 1) {
                    const potentialUnit = String(row[cFirst + 1] || '').trim();
                    if (potentialUnit.length < 10 && /^[\[\(\{]/.test(potentialUnit)) {
                        unit = potentialUnit;
                    }
                }

                // Case B: Unit is after Value (Name | Value | Unit)
                if (!unit) {
                    const nextCell = String(row[cFirst + 2] || '').trim();
                    if (nextCell.length < 10 && /^[\[\(\{]/.test(nextCell)) {
                        unit = nextCell;
                    }
                }

                currentGroup.parameters.push({
                    id: this.generateId(text),
                    name: text,
                    unit: unit,
                    type: typeof val === 'number' ? 'number' : 'text',
                    userComment: '',
                    checkStatus: '',
                    mandatoryStatus: 'optional' // Default to optional for discovered params
                });

                // Capture the value immediately for this newly created parameter!
                // This creates a "seed" value so that extractAllParameters will definitely find it later,
                // or we could return values directly from discovery, but sticking to the 2-step process is fine
                // as long as extractAllParameters logic aligns.
                continue;
            }
        }

        // Push last group
        if (currentGroup.parameters.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    private isValidText(val: any): boolean {
        return val && String(val).trim().length > 1;
    }

    private generateId(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) + '_' + Math.floor(Math.random() * 1000);
    }

    private isValidValue(val: any): boolean {
        if (val === undefined || val === null) return false;
        const s = String(val).trim();
        // Ignore "empty" looking strings or typical placeholders
        if (['', '-', 'n/a', 'na'].includes(s.toLowerCase())) return false;
        return true;
    }
}
