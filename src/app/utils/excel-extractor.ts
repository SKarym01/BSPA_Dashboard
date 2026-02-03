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

  private static readonly PARAM_TOKENS = ['parametercheck', 'parameter check', 'parameter', 'param'];
  private static readonly COMMENT_TOKENS = ['free text', 'free-text', 'freetext', 'comment', 'comments', 'kommentar', 'bemerkung'];
  private static readonly UNIT_TOKENS = ['unit', 'units', 'einheit'];
  private static readonly CHECK_TOKENS = ['check', 'status'];

  constructor(rawData: any[][]) {
    this.rawData = rawData;
  }

  // ----------------------------
  // IMPORTANT: Header normalization (NO stopword removal)
  // ----------------------------
  private normHeader(input: any): string {
    // basic = ohne Stopword-Removal -> "check", "parameter" bleiben erhalten
    return normalizeText(input, 'basic');
  }

  private tokenMatches(headerNorm: string, tokens: string[]): boolean {
    const h = this.normHeader(headerNorm);
    return tokens.some(t => {
      const tn = this.normHeader(t);
      return h === tn || h.includes(tn);
    });
  }

  // ----------------------------
  // Main entry point: Extracts all parameters defined in the groups.
  // ----------------------------
  public extractAllParameters(groups: ParameterGroup[]): ExtractedValue[] {
    const results: ExtractedValue[] = [];
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

  private findBestMatch(targetNum: string, targetId: string): { value: any, score: number, r: number, c: number } | null {
    let bestMatch = null;
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
      emptyStreak += 1;
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
    if (targetId && cellText.toLowerCase().includes(targetId.toLowerCase())) {
      return 100;
    }
    const normTarget = normalizeText(targetName, 'strong');
    const normCell = normalizeText(cellText, 'strong');
    if (normCell === normTarget) return 100;
    return tokenSetRatio(targetName, cellText);
  }

  private extractValueForLabel(r: number, c: number): any {
    const row = this.rawData[r];
    const nextRow = this.rawData[r + 1];

    const valRight = row[c + 1];
    if (this.isLikelyValue(valRight)) return valRight;

    const valRight2 = row[c + 2];
    if (this.isLikelyValue(valRight2)) return valRight2;

    if (nextRow) {
      const valBelow = nextRow[c];
      if (this.isLikelyValue(valBelow)) return valBelow;
    }
    return null;
  }

  public discoverParameterGroups(): ParameterGroup[] {
    const groups: ParameterGroup[] = [];
    let currentGroup: ParameterGroup = { groupName: 'General Parameters', parameters: [] };

    const isHeader = (r: number, cStart: number, text: string): boolean => {
      const row = this.rawData[r];
      const hasValueNeighbor = (row[cStart + 1] || row[cStart + 2] || row[cStart + 3]);
      const isNumbered = /^\d+(\.\d+)*\.?\s/.test(text);
      const norm = normalizeText(text, 'strong');
      const tooLong = text.length > ExcelExtractor.MAX_LABEL_CHARS || norm.split(' ').length > ExcelExtractor.MAX_LABEL_TOKENS;
      return !hasValueNeighbor && !tooLong && (isNumbered || text.length < 50);
    };

    for (let r = 0; r < this.rawData.length; r++) {
      const row = this.rawData[r];
      if (!row || row.length === 0) continue;

      const cFirst = row.findIndex(cell => this.isLikelyLabel(cell));
      if (cFirst === -1) continue;

      const text = String(row[cFirst]).trim();
      const val = this.extractValueForLabel(r, cFirst);

      if (!val && isHeader(r, cFirst, text)) {
        if (currentGroup.parameters.length > 0) groups.push(currentGroup);
        currentGroup = { groupName: text, parameters: [] };
        continue;
      }

      if (this.isLikelyValue(val)) {
        let unit = '';
        const cVal = row.indexOf(val, cFirst + 1);
        if (cVal > cFirst + 1) unit = String(row[cFirst + 1] || '').trim();

        currentGroup.parameters.push({
          id: this.generateId(text),
          name: text,
          unit: unit,
          type: typeof val === 'number' ? 'number' : 'text',
          defaultValue: val,
          userComment: '',
          checkStatus: ''
        });
      }
    }

    if (currentGroup.parameters.length > 0) groups.push(currentGroup);
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

    if (s.length > 60) return false;

    const norm = normalizeText(s, 'strong');
    const tokenCount = norm ? norm.split(' ').length : 0;
    if (tokenCount > 8) return false;

    if (this.isLikelyLabel(s) && s.length > 18) return false;
    return true;
  }

  // ===========================
  // MATRIX PARSER (Fixed Columns + Variants)
  // ===========================
  public parseMatrixFromSheet():
   {
    
    parameterGroups: ParameterGroup[];
    variants: { id: string; name: string; values: Record<string, any> }[];
  } | null {
    
    const variantNames = this.extractVariantNames();

// Wenn zu wenige Varianten gefunden wurden, ist das als Anker unzuverlässig.
// Dann lieber token-basiert den Header finden.
const MIN_VARIANTS_FOR_ANCHOR = 5;

const header = variantNames.length >= MIN_VARIANTS_FOR_ANCHOR
  ? (this.findMatrixHeaderRow(variantNames) ?? this.findHeaderRowByTokens())
  : this.findHeaderRowByTokens();


    if (!header) return null;

    // refine fixed cols from data (robust)
    const refined = this.refineColumns(
      header.headerRow,
      header.paramCol,
      header.commentCol,
      header.checkCol,
      header.unitCol,
      header.colMap
    );

    const { headerRow, fixedCols } = refined;

    // 1) read groups + params
    const groups: ParameterGroup[] = [];
    let currentGroup: ParameterGroup = { groupName: 'General Parameters', parameters: [] };

    for (let r = headerRow + 1; r < this.rawData.length; r++) {
      const row = this.rawData[r] || [];
      if (this.isParametercheckRow(row)) continue;

      const prevRow = this.rawData[r - 1] || [];

if (this.isCategoryRowWithContext(row, prevRow)) {
  const name = String(row[this.firstNonEmptyCol(row)]).trim();
  if (currentGroup.parameters.length > 0) groups.push(currentGroup);
  currentGroup = { groupName: name, parameters: [] };
  continue;
}

      const paramName = this.readParamNameFromRow(row, fixedCols.paramCol);
      if (!paramName) continue;

      const norm = normalizeText(paramName, 'strong');
      if (!norm || ExcelExtractor.GARBAGE_LABELS.has(norm)) continue;

      const unit = this.cellToString(row, fixedCols.unitCol);
      const comment = this.cellToString(row, fixedCols.commentCol);
      const check = this.normalizeCheckStatus(this.cellToString(row, fixedCols.checkCol));

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

    // 2) only variant columns right of fixed columns
    const fixedMax = Math.max(
      fixedCols.paramCol ?? -1,
      fixedCols.commentCol ?? -1,
      fixedCols.checkCol ?? -1,
      fixedCols.unitCol ?? -1
    );
    
    const cleanColEntries = Object.entries(refined.colMap)
      .map(([colStr, name]) => ({ col: Number(colStr), name }))
      .filter(e => e.col > fixedMax)
      .sort((a, b) => a.col - b.col);

    const variants = cleanColEntries.map((ce, idx) => ({
      id: `v${idx + 1}`,
      name: ce.name || `Variant ${idx + 1}`,
      values: {} as Record<string, any>
    }));

    const colToVariantIndex = new Map<number, number>();
    cleanColEntries.forEach((ce, idx) => colToVariantIndex.set(ce.col, idx));

    // 3) param index
    const paramIndex = new Map<string, ParameterRow>();
    for (const g of groups) {
      for (const p of g.parameters) {
        paramIndex.set(normalizeText(p.name, 'strong'), p);
      }
    }

    // 4) fill values
    for (let r = headerRow + 1; r < this.rawData.length; r++) {
      const row = this.rawData[r] || [];
      if (this.isParametercheckRow(row)) continue;

      if (this.isCategoryRow(row)) continue;

      const paramName = this.readParamNameFromRow(row, fixedCols.paramCol);
      if (!paramName) continue;

      const key = normalizeText(paramName, 'strong');
      const param = paramIndex.get(key);
      if (!param) continue;

      for (const ce of cleanColEntries) {
        const v = row[ce.col];
        if (!this.isLikelyValue(v)) continue;
        const vi = colToVariantIndex.get(ce.col);
        if (vi === undefined) continue;
        variants[vi].values[param.id] = v;
      }
    }

    return { parameterGroups: groups, variants };
  }

  private readParamNameFromRow(row: any[], paramCol: number | null): string {
    if (paramCol !== null && paramCol !== undefined && paramCol < row.length) {
      const v = row[paramCol];
      if (this.isLikelyLabel(v)) return String(v).trim();
    }
    for (let c = 0; c < Math.min(3, row.length); c++) {
      const v = row[c];
      if (this.isLikelyLabel(v)) return String(v).trim();
    }
    return '';
  }
private isParametercheckRow(row: any[]): boolean {
  const c = this.firstNonEmptyCol(row);
  if (c < 0) return false;

  const v = row[c];
  if (!v) return false;

  const norm = normalizeText(String(v), 'strong');
  return norm.startsWith('parameterche'); // parametercheck + abgeschnitten
}


  /**
   * Detect unit/check columns from actual data contents (NOT normalizeText, because "check" is a stopword!)
   */
  private refineColumns(
    headerRow: number,
    paramCol: number | null,
    commentCol: number | null,
    checkCol: number | null,
    unitCol: number | null,
    colMap: { [col: number]: string }
  ): {
    headerRow: number;
    fixedCols: { paramCol: number | null; commentCol: number | null; checkCol: number | null; unitCol: number | null };
    colMap: { [col: number]: string };
  } {
    const SAMPLE_ROWS = 50;
    const start = headerRow + 1;
    const end = Math.min(this.rawData.length, start + SAMPLE_ROWS);

    const colStats = new Map<number, { nonEmpty: number; unitLike: number; checkLike: number }>();

    const UNIT_WHITELIST = new Set([
  '-', '—', '[-]',
  'mm', 'cm', 'm',
  'kg', 'g',
  'bar', 'mbar', 'pa', 'kpa', 'mpa',
  'v', 'mv',
  'a', 'ma',
  'nm', 'n', 'kn',
  's', 'ms',
  '%', 'deg', '°c', 'c'
]);

const isUnitLike = (v: any) => {
  if (v === undefined || v === null) return false;

  const raw = String(v).trim();
  if (!raw) return false;

  // Normalisiere: ohne Leerzeichen
  const compact = raw.replace(/\s+/g, '');

  // 1) Dimensionless
  if (compact === '[-]' || compact === '-' || compact === '—') return true;

  // 2) Wenn es in Klammern steht -> typischer Unit-Fall: [kg], [mm], (V)
  const hasBrackets = /[\[\(\{].*[\]\)\}]/.test(compact);
  if (hasBrackets) {
    // Inhalt extrahieren ohne Klammern
    const inner = compact.replace(/^[\[\(\{]/, '').replace(/[\]\)\}]$/, '').toLowerCase();
    if (UNIT_WHITELIST.has(inner)) return true;
    // auch Sachen wie m/s, Nm, % erlauben
    if (/^[-a-z0-9/%°]{1,12}$/i.test(inner) && /[a-z%°]/i.test(inner)) return true;
    return false;
  }

  // 3) Ohne Klammern nur dann Unit, wenn es wirklich eine Unit ist (Whitelist)
  const low = compact.toLowerCase();

  // Check-Wörter explizit ausschließen
  if (['check', 'status', 'ok', 'nok', 'na', 'n/a', 'yes', 'no'].includes(low)) return false;

  return UNIT_WHITELIST.has(low);
};

    const isCheckLike = (v: any) => {
      if (v === undefined || v === null) return false;
      const s = String(v).trim().toLowerCase();
      if (!s) return false;
      return ['ok', 'nok', 'na', 'n/a', 'check', 'status', 'yes', 'no'].includes(s);
    };

    for (let r = start; r < end; r++) {
      const row = this.rawData[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v === undefined || v === null || String(v).trim() === '') continue;

        const st = colStats.get(c) ?? { nonEmpty: 0, unitLike: 0, checkLike: 0 };
        st.nonEmpty += 1;
        if (isUnitLike(v)) st.unitLike += 1;
        if (isCheckLike(v)) st.checkLike += 1;
        colStats.set(c, st);
      }
    }

    const bestByRatio = (kind: 'unitLike' | 'checkLike', preferNear?: number | null) => {
      let bestCol: number | null = null;
      let bestScore = 0;

      for (const [c, st] of colStats.entries()) {
        if (st.nonEmpty < 6) continue;
        const ratio = st[kind] / st.nonEmpty;

        // a bit looser, because many unit cells might be empty
        if (ratio < 0.40) continue;

        let score = ratio * 100;
        if (preferNear !== null && preferNear !== undefined) {
          const dist = Math.abs(c - preferNear);
          score -= Math.min(25, dist * 2);
        }

        if (score > bestScore) {
          bestScore = score;
          bestCol = c;
        }
      }

      return bestCol;
    };
// Wenn Header-Parsing bereits eine Spalte gefunden hat, NICHT überschreiben.
// Nur raten, wenn es wirklich NULL ist.
const inferredUnitCol = unitCol !== null && unitCol !== undefined
  ? unitCol
  : bestByRatio('unitLike', paramCol);

const inferredCheckCol = checkCol !== null && checkCol !== undefined
  ? checkCol
  : bestByRatio('checkLike', inferredUnitCol ?? paramCol);


    return {
      headerRow,
      fixedCols: {
        paramCol,
        commentCol,
        checkCol: inferredCheckCol,
        unitCol: inferredUnitCol
      },
      colMap
    };
  }

  private isCategoryRow(row: any[]): boolean {
    const nonEmptyIdx = this.firstNonEmptyCol(row);
    if (nonEmptyIdx === -1) return false;
    const label = row[nonEmptyIdx];
    if (!this.isLikelyLabel(label)) return false;
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
        if (s.includes('customer platform variants'))  {
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
let emptyStreak = 0;

for (let r = headerRow + 1; r < Math.min(headerRow + 300, this.rawData.length); r++) {
  const row = this.rawData[r] || [];
  const v = row[nameCol];

  const name = v !== undefined && v !== null ? String(v).trim() : '';

  // Leerzeile => NICHT sofort abbrechen, sondern zählen
  if (!name) {
    emptyStreak += 1;
    if (emptyStreak >= 8) break; // erst nach mehreren leeren Zeilen stoppen
    continue;
  }

  emptyStreak = 0;

  // Hinweiszeilen überspringen statt abbrechen
  if (normalizeText(name, 'strong').includes('attention')) continue;

  variants.push(name);
}

return Array.from(new Set(variants));

  }

  private findMatrixHeaderRow(variants: string[]): {
    headerRow: number;
    colMap: { [col: number]: string };
    paramCol: number | null;
    commentCol: number | null;
    checkCol: number | null;
    unitCol: number | null;
  } | null {
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

        // IMPORTANT: header norm must be 'basic'
        const cellNorm = this.normHeader(cell);

        if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) { paramCol = c; continue; }
        if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS)) { checkCol = c; continue; }
        if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) { commentCol = c; continue; }
        if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) { unitCol = c; continue; }

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

  private findHeaderRowByTokens(): {
    headerRow: number;
    colMap: { [col: number]: string };
    paramCol: number | null;
    commentCol: number | null;
    checkCol: number | null;
    unitCol: number | null;
  } | null {
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

        // IMPORTANT: header norm must be 'basic'
        const cellNorm = this.normHeader(cell);

        if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) { paramCol = c; continue; }
        if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS)) { checkCol = c; continue; }
        if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) { commentCol = c; continue; }
        if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) { unitCol = c; continue; }
      }

      // comment is a good anchor, param might be missed in some sheets -> but we still require comment
      // Kommentarspalte ist hilfreich, aber nicht zwingend.
if (paramCol === null && commentCol === null) continue;


const startCol = Math.max(paramCol ?? -1, commentCol ?? -1, unitCol ?? -1, checkCol ?? -1) + 1;

      let found = 0;
      let emptyStreak = 0;

      for (let c = startCol; c < row.length; c++) {
        const cell = this.getHeaderCellValue(r, c, paramCol, false);
        if (!cell) continue;

        const cellNorm = this.normHeader(cell);
        if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) continue;
        if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS)) continue;
        if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) continue;
        if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) continue;

        const normStrong = normalizeText(cell, 'strong');
        if (ExcelExtractor.GARBAGE_LABELS.has(normStrong)) continue;

        colMap[c] = cell;
        found += 1;
        emptyStreak = 0;
        if (found >= 12) break;
      }

      if (found < 1) {
        for (let c = startCol; c < row.length; c++) {
          const cell = this.getHeaderCellValue(r, c, paramCol, true);
          if (!cell) {
            emptyStreak += 1;
            if (emptyStreak >= 5) break;
            continue;
          }

          const cellNorm = this.normHeader(cell);
          if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) continue;
          if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS)) continue;
          if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS)) continue;
          if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS)) continue;

          const normStrong = normalizeText(cell, 'strong');
          if (ExcelExtractor.GARBAGE_LABELS.has(normStrong)) continue;

          colMap[c] = cell;
          found += 1;
          if (found >= 12) break;
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
    if (v1 !== undefined && v1 !== null && String(v1).trim() !== '') return String(v1).trim();

    const v0 = this.rawData[secondaryRow]?.[colIndex];
    if (v0 !== undefined && v0 !== null && String(v0).trim() !== '') return String(v0).trim();

    return '';
  }

  private cellToString(row: any[], col: number | null | undefined): string {
    if (col === null || col === undefined) return '';
    const v = row[col];
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

 private normalizeCheckStatus(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const v = raw.toLowerCase();

  // Standard mappings
  if (v === 'ok') return 'ok';
  if (v === 'nok' || v === 'not ok' || v === 'notok') return 'nok';
  if (v === 'na' || v === 'n a' || v === 'n/a') return 'na';

  // BSPA / Rulebook Tokens (falls ihr sowas habt)
  if (v === 'r') return 'R';
  if (v === 'rd') return 'RD';
  if (v === 'o') return 'O';

  // WICHTIG: alles andere beibehalten (z.B. "check")
  return raw;
}
public extractProjectDescription(): { key: string; value: string }[] {
  const results: { key: string; value: string }[] = [];

  // 1) Start: "project description" suchen
  let startRow = -1;
  for (let r = 0; r < this.rawData.length; r++) {
    const row = this.rawData[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (!v) continue;
      const s = normalizeText(String(v), 'strong');
      if (s.includes('project description')) {
        startRow = r;
        break;
      }
    }
    if (startRow >= 0) break;
  }
  if (startRow < 0) return [];

  // 2) Die Key/Value-Spalten bestimmen (erste Zeile nach header mit >=2 non-empty)
  let keyCol = -1;
  let valueCol = -1;

  for (let r = startRow + 1; r < Math.min(startRow + 20, this.rawData.length); r++) {
    const row = this.rawData[r] || [];
    const nonEmpty: number[] = [];
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? '').trim();
      if (s !== '') nonEmpty.push(c);
    }
    if (nonEmpty.length >= 2) {
      keyCol = nonEmpty[0];
      valueCol = nonEmpty[1];
      break;
    }
  }

  if (keyCol < 0 || valueCol < 0) return [];

  // 3) Zeilen einsammeln bis leer / nächster Abschnitt
  let emptyStreak = 0;

  for (let r = startRow + 1; r < Math.min(startRow + 300, this.rawData.length); r++) {
    const row = this.rawData[r] || [];

    // Stopper: nächster großer Block beginnt
    const rowText = (row || []).map(x => normalizeText(String(x ?? ''), 'strong')).join(' ');
    if (rowText.includes('customer platform variants')) break;
    if (rowText.startsWith('parameterche')) break; // Parametercheck-Trenner
    if (rowText.includes('parameter template')) break;

    const key = String(row[keyCol] ?? '').trim();
const value = String(row[valueCol] ?? '').trim();

if (!key && !value) {
  emptyStreak += 1;
  if (emptyStreak >= 6) break;
  continue;
}
emptyStreak = 0;

// ✅ STOPP: NICHT "Premises" aufnehmen
const keyNorm = normalizeText(key, 'strong');
if (keyNorm === 'premises' || keyNorm.startsWith('premis')) {
  break;
}

// Key muss label-like sein
if (!this.isLikelyLabel(key)) continue;

results.push({ key, value });

    results.push({ key, value });
  }

  // Duplikate vermeiden
  const seen = new Set<string>();
  return results.filter(it => {
    const k = normalizeText(it.key, 'strong');
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
private prevRowIsCategorySeparator(prevRow: any[] | undefined): boolean {
  if (!prevRow || prevRow.length === 0) return false;

  for (const cell of prevRow) {
    if (cell === undefined || cell === null) continue;
    const s = String(cell).trim();
    if (!s) continue;

    const norm = normalizeText(s, 'strong');

    // "Parametercheck" (auch abgeschnitten wie "Parameterche")
    if (norm.startsWith('parameterche')) return true;

    // typische Trenner/Header-Tokens (free-text/comment/unit/check/status)
    if (this.tokenMatches(norm, ExcelExtractor.COMMENT_TOKENS)) return true;
    if (this.tokenMatches(norm, ExcelExtractor.UNIT_TOKENS)) return true;
    if (this.tokenMatches(norm, ExcelExtractor.CHECK_TOKENS)) return true;

    // optional: auch "parameter" / "param" Zeilen als Trenner akzeptieren
    if (this.tokenMatches(norm, ExcelExtractor.PARAM_TOKENS)) return true;
  }

  return false;
}

/**
 * Kategorie nur dann, wenn:
 * 1) Zeile sieht wie Kategorie aus (nur 1 nicht-leere Zelle)
 * 2) Direkt davor steht eine Trenner-Zeile (Parametercheck/free-text/...)
 */
private isCategoryRowWithContext(row: any[], prevRow: any[] | undefined): boolean {
  if (!this.isCategoryRow(row)) return false;          // deine bestehende "single-cell" Logik
  return this.prevRowIsCategorySeparator(prevRow);     // NEU: Kontextregel
}


}
