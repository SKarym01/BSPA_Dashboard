"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelExtractor = void 0;
const text_norm_1 = require("./text-norm");
/**
 * ExcelExtractor (merged):
 * - Keeps OLD robust matching + label/value heuristics + matrix parsing + project description extraction
 * - Keeps NEW additions: default mandatoryStatus for discovered params + clearer value validation helper
 * - Fixes common failure modes from the NEW simplified version (too many false label hits, bad thresholds)
 */
class ExcelExtractor {
    constructor(rawData) {
        this.curveBlockConfigs = [
            {
                title: 'pV Curve of one front wheel',
                groupName: 'pV Curves (wheel and brake tubes from hydraulic unit to wheel brakes)',
                xHeaderRowOffset: 1,
                xDataStartRowOffset: 2
            },
            {
                title: 'pV Curve of one rear wheel',
                groupName: 'pV Curves (wheel and brake tubes from hydraulic unit to wheel brakes)',
                xHeaderRowOffset: 1,
                xDataStartRowOffset: 2
            },
            {
                title: 'PV Curve of peripherals: DPB<->ESP connection line only',
                groupName: 'pV Curves (wheel and brake tubes from hydraulic unit to wheel brakes)',
                xHeaderRowOffset: 1,
                xDataStartRowOffset: 2
            },
            {
                title: 'PFS curve',
                groupName: 'Pedal Feel Characteristics - IPB / DPB (details)',
                xHeaderRowOffset: 2,
                xDataStartRowOffset: 3,
                yHeaderRowOffset: 19,
                yDataStartRowOffset: 20
            },
            {
                title: 'DBR Curve',
                groupName: 'Pedal Feel Characteristics - IPB / DPB (details)',
                xHeaderRowOffset: 2,
                xDataStartRowOffset: 3,
                yHeaderRowOffset: 19,
                yDataStartRowOffset: 20
            },
            {
                title: 'True pedal feel curve',
                groupName: 'Pedal Feel Characteristics - IPB / DPB (details)',
                xHeaderRowOffset: 2,
                xDataStartRowOffset: 3,
                yHeaderRowOffset: 19,
                yDataStartRowOffset: 20
            }
        ];
        this.rawData = rawData;
    }
    // ----------------------------
    // IMPORTANT: Header normalization (NO stopword removal)
    // ----------------------------
    normHeader(input) {
        // basic = without stopword removal -> keeps "check", "parameter"
        return (0, text_norm_1.normalizeText)(input, 'basic');
    }
    tokenMatches(headerNorm, tokens) {
        const h = this.normHeader(headerNorm);
        return tokens.some(t => {
            const tn = this.normHeader(t);
            return h === tn || h.includes(tn);
        });
    }
    // ----------------------------
    // Main entry points
    // ----------------------------
    extractAllParameters(groups) {
        const results = [];
        const allParams = groups.flatMap(g => g.parameters);
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
    extractAllParametersWithColumns(groups) {
        const results = [];
        const allParams = groups.flatMap(g => g.parameters);
        allParams.forEach(param => {
            const label = this.findBestLabelCell(param.name, param.id);
            if (!label)
                return;
            const values = this.extractRowValues(label.r, label.c);
            if (values.length === 0)
                return;
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
    // ----------------------------
    // Matching core (OLD robust)
    // ----------------------------
    findBestMatch(targetName, targetId) {
        let bestMatch = null;
        let bestScore = 0;
        const normTarget = (0, text_norm_1.normalizeText)(targetName, 'strong');
        if (!normTarget || normTarget.length < 3)
            return null;
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const cellVal = row[c];
                if (!cellVal)
                    continue;
                const cellStr = String(cellVal);
                if (!this.isLikelyLabel(cellStr))
                    continue;
                const score = this.calculateMatchScore(targetName, targetId, cellStr);
                if (score >= ExcelExtractor.MIN_MATCH_SCORE && score > bestScore) {
                    const value = this.extractValueForLabel(r, c);
                    if (this.isValidValue(value)) {
                        bestScore = score;
                        bestMatch = { value, score, r, c };
                    }
                }
            }
        }
        return bestMatch;
    }
    findBestLabelCell(targetName, targetId) {
        let best = null;
        let bestScore = 0;
        const normTarget = (0, text_norm_1.normalizeText)(targetName, 'strong');
        if (!normTarget || normTarget.length < 3)
            return null;
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const cellVal = row[c];
                if (!cellVal)
                    continue;
                const cellStr = String(cellVal);
                if (!this.isLikelyLabel(cellStr))
                    continue;
                const score = this.calculateMatchScore(targetName, targetId, cellStr);
                if (score >= ExcelExtractor.MIN_MATCH_SCORE && score > bestScore) {
                    bestScore = score;
                    best = { score, r, c };
                }
            }
        }
        return best;
    }
    calculateMatchScore(targetName, targetId, cellText) {
        // 1) Direct ID match
        if (targetId && cellText.toLowerCase().includes(targetId.toLowerCase())) {
            return 100;
        }
        // 2) Exact normalized match
        const normTarget = (0, text_norm_1.normalizeText)(targetName, 'strong');
        const normCell = (0, text_norm_1.normalizeText)(cellText, 'strong');
        if (normCell === normTarget)
            return 100;
        // 3) Fuzzy token match
        return (0, text_norm_1.tokenSetRatio)(targetName, cellText);
    }
    // ----------------------------
    // Value extraction (kept)
    // ----------------------------
    extractValueForLabel(r, c) {
        const row = this.rawData[r] || [];
        const nextRow = this.rawData[r + 1];
        const valRight = row[c + 1];
        if (this.isValidValue(valRight))
            return valRight;
        const valRight2 = row[c + 2];
        if (this.isValidValue(valRight2))
            return valRight2;
        if (nextRow) {
            const valBelow = nextRow[c];
            if (this.isValidValue(valBelow))
                return valBelow;
        }
        return null;
    }
    extractRowValues(r, c) {
        const row = this.rawData[r] || [];
        const values = [];
        let emptyStreak = 0;
        for (let col = c + 1; col < row.length; col++) {
            const val = row[col];
            if (this.isValidValue(val)) {
                values.push({ col, value: val });
                emptyStreak = 0;
                continue;
            }
            emptyStreak += 1;
            if (emptyStreak >= 3)
                break;
        }
        return values;
    }
    getColumnHeader(col, startRow) {
        for (let r = startRow - 1; r >= 0 && r >= startRow - 3; r--) {
            const row = this.rawData[r];
            if (!row)
                continue;
            const val = row[col];
            if (this.isLikelyLabel(val))
                return String(val).trim();
        }
        return '';
    }
    // ----------------------------
    // Discovery (OLD robust + NEW "mandatoryStatus default optional")
    // ----------------------------
    discoverParameterGroups() {
        const groups = [];
        let currentGroup = { groupName: 'General Parameters', parameters: [] };
        const isHeader = (r, cStart, text) => {
            const row = this.rawData[r] || [];
            const hasValueNeighbor = (row[cStart + 1] || row[cStart + 2] || row[cStart + 3]);
            const isNumbered = /^\d+(\.\d+)*\.?\s/.test(text);
            const norm = (0, text_norm_1.normalizeText)(text, 'strong');
            const tooLong = text.length > ExcelExtractor.MAX_LABEL_CHARS || norm.split(' ').length > ExcelExtractor.MAX_LABEL_TOKENS;
            return !hasValueNeighbor && !tooLong && (isNumbered || text.length < 50);
        };
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            if (row.length === 0)
                continue;
            const cFirst = row.findIndex(cell => this.isLikelyLabel(cell));
            if (cFirst === -1)
                continue;
            const text = String(row[cFirst]).trim();
            const val = this.extractValueForLabel(r, cFirst);
            // Header / Group
            if (!val && isHeader(r, cFirst, text)) {
                if (currentGroup.parameters.length > 0)
                    groups.push(currentGroup);
                currentGroup = { groupName: text, parameters: [] };
                continue;
            }
            // Parameter row
            if (this.isValidValue(val)) {
                let unit = '';
                const cVal = row.indexOf(val, cFirst + 1);
                if (cVal > cFirst + 1) {
                    unit = String(row[cFirst + 1] || '').trim();
                }
                const lowerName = text.toLowerCase();
                const isCurve = lowerName.includes('charac') || lowerName.includes('curve') || lowerName.includes('profile');
                currentGroup.parameters.push({
                    id: this.generateId(text),
                    name: text,
                    unit: unit || '',
                    type: isCurve ? 'curve' : (typeof val === 'number' ? 'number' : 'text'),
                    defaultValue: val,
                    userComment: '',
                    checkStatus: '',
                    // NEW: Prototype random mandatoryStatus
                    mandatoryStatus: ['mandatory', 'semi-mandatory', 'optional', 'irrelevant'][Math.floor(Math.random() * 4)]
                });
            }
        }
        if (currentGroup.parameters.length > 0)
            groups.push(currentGroup);
        return groups;
    }
    // ----------------------------
    // Label / value heuristics (OLD robust) + NEW naming (isValidValue)
    // ----------------------------
    isLikelyLabel(val) {
        if (!val)
            return false;
        const text = String(val).trim();
        if (text.length < 2)
            return false;
        if (text.length > ExcelExtractor.MAX_LABEL_CHARS)
            return false;
        const norm = (0, text_norm_1.normalizeText)(text, 'strong');
        if (!norm || norm.length < 2)
            return false;
        // Only digits/symbols -> not a label
        if (/^[0-9\.\-_/]+$/.test(text))
            return false;
        const tokens = norm.split(' ').filter(Boolean);
        if (tokens.length > ExcelExtractor.MAX_LABEL_TOKENS)
            return false;
        const letters = (text.match(/[a-zA-Z]/g) || []).length;
        if (letters < 2)
            return false;
        if (ExcelExtractor.GARBAGE_LABELS.has(norm))
            return false;
        return true;
    }
    isValidValue(val) {
        // NEW version helper semantics, but with OLD robustness
        if (val === undefined || val === null)
            return false;
        if (typeof val === 'number' || typeof val === 'boolean')
            return true;
        const s = String(val).trim();
        if (!s)
            return false;
        const lower = s.toLowerCase();
        if (['-', 'n/a', 'na', 'none', 'tbd'].includes(lower))
            return false;
        // avoid long texts (often comments / descriptions)
        if (s.length > 60)
            return false;
        const norm = (0, text_norm_1.normalizeText)(s, 'strong');
        const tokenCount = norm ? norm.split(' ').length : 0;
        if (tokenCount > 8)
            return false;
        // if it looks like a label, don't accept as a value (common false positives)
        if (this.isLikelyLabel(s) && s.length > 18)
            return false;
        return true;
    }
    generateId(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) + '_' + Math.floor(Math.random() * 1000);
    }
    // ===========================
    // MATRIX PARSER (Fixed Columns + Variants)  (OLD kept)
    // ===========================
    parseMatrixFromSheet() {
        const variantNames = this.extractVariantNames();
        // anchor decision (kept)
        const MIN_VARIANTS_FOR_ANCHOR = 5;
        const header = variantNames.length >= MIN_VARIANTS_FOR_ANCHOR
            ? (this.findMatrixHeaderRow(variantNames) ?? this.findHeaderRowByTokens())
            : this.findHeaderRowByTokens();
        if (!header)
            return null;
        // refine fixed cols from data (robust)
        const refined = this.refineColumns(header.headerRow, header.paramCol, header.commentCol, header.checkCol, header.unitCol, header.colMap);
        const { headerRow, fixedCols } = refined;
        // 1) read groups + params
        const groups = [];
        let currentGroup = { groupName: 'General Parameters', parameters: [] };
        for (let r = headerRow + 1; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            if (this.isParametercheckRow(row))
                continue;
            const prevRow = this.rawData[r - 1] || [];
            if (this.isCategoryRowWithContext(row, prevRow)) {
                const name = String(row[this.firstNonEmptyCol(row)]).trim();
                if (currentGroup.parameters.length > 0)
                    groups.push(currentGroup);
                currentGroup = { groupName: name, parameters: [] };
                continue;
            }
            const paramName = this.readParamNameFromRow(row, fixedCols.paramCol);
            if (!paramName)
                continue;
            const norm = (0, text_norm_1.normalizeText)(paramName, 'strong');
            if (!norm || ExcelExtractor.GARBAGE_LABELS.has(norm))
                continue;
            const unit = this.cellToString(row, fixedCols.unitCol);
            const comment = this.cellToString(row, fixedCols.commentCol);
            const check = this.normalizeCheckStatus(this.cellToString(row, fixedCols.checkCol));
            const lowerName = paramName.toLowerCase();
            const isCurve = lowerName.includes('charac') || lowerName.includes('curve') || lowerName.includes('profile');
            currentGroup.parameters.push({
                id: this.generateId(paramName),
                name: paramName,
                unit: unit || '',
                type: isCurve ? 'curve' : 'text',
                userComment: comment || '',
                checkStatus: check || '',
                // NEW: Prototype random mandatoryStatus
                mandatoryStatus: ['mandatory', 'semi-mandatory', 'optional', 'irrelevant'][Math.floor(Math.random() * 4)]
            });
        }
        if (currentGroup.parameters.length > 0)
            groups.push(currentGroup);
        // 2) only variant columns right of fixed columns
        const fixedMax = Math.max(fixedCols.paramCol ?? -1, fixedCols.commentCol ?? -1, fixedCols.checkCol ?? -1, fixedCols.unitCol ?? -1);
        const cleanColEntries = Object.entries(refined.colMap)
            .map(([colStr, name]) => ({ col: Number(colStr), name }))
            .filter(e => e.col > fixedMax)
            .sort((a, b) => a.col - b.col);
        const variants = cleanColEntries.map((ce, idx) => ({
            id: `v${idx + 1}`,
            name: ce.name || `Variant ${idx + 1}`,
            values: {}
        }));
        const colToVariantIndex = new Map();
        cleanColEntries.forEach((ce, idx) => colToVariantIndex.set(ce.col, idx));
        // 3) param index
        const paramIndex = new Map();
        for (const g of groups) {
            for (const p of g.parameters) {
                paramIndex.set((0, text_norm_1.normalizeText)(p.name, 'strong'), p);
            }
        }
        // 4) fill values
        for (let r = headerRow + 1; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            if (this.isParametercheckRow(row))
                continue;
            if (this.isCategoryRow(row))
                continue;
            const paramName = this.readParamNameFromRow(row, fixedCols.paramCol);
            if (!paramName)
                continue;
            const key = (0, text_norm_1.normalizeText)(paramName, 'strong');
            const param = paramIndex.get(key);
            if (!param)
                continue;
            for (const ce of cleanColEntries) {
                const v = row[ce.col];
                if (!this.isValidValue(v))
                    continue;
                const vi = colToVariantIndex.get(ce.col);
                if (vi === undefined)
                    continue;
                variants[vi].values[param.id] = v;
            }
        }
        this.injectCurveParameters(groups, variants, cleanColEntries);
        return { parameterGroups: groups, variants };
    }
    injectCurveParameters(groups, variants, cleanColEntries) {
        for (const config of this.curveBlockConfigs) {
            const titleRow = this.findTitleRow(config.title);
            if (titleRow < 0)
                continue;
            const parameter = this.ensureCurveParameter(groups, config);
            const seriesByVariant = this.extractCurveBlockSeries(titleRow, config, cleanColEntries);
            for (const variant of variants) {
                const curveValue = seriesByVariant.get(variant.name);
                if (curveValue && curveValue.points.length > 0) {
                    variant.values[parameter.id] = curveValue;
                }
            }
        }
    }
    ensureCurveParameter(groups, config) {
        let group = groups.find(g => (0, text_norm_1.normalizeText)(g.groupName, 'strong') === (0, text_norm_1.normalizeText)(config.groupName, 'strong'));
        if (!group) {
            group = { groupName: config.groupName, parameters: [] };
            groups.push(group);
        }
        const existing = group.parameters.find(p => (0, text_norm_1.normalizeText)(p.name, 'strong') === (0, text_norm_1.normalizeText)(config.title, 'strong'));
        if (existing) {
            existing.type = 'curve';
            return existing;
        }
        const parameter = {
            id: this.generateId(config.title),
            name: config.title,
            unit: '',
            type: 'curve',
            userComment: '',
            checkStatus: '',
            mandatoryStatus: 'mandatory'
        };
        group.parameters.push(parameter);
        return parameter;
    }
    extractCurveBlockSeries(titleRow, config, cleanColEntries) {
        const xHeaderRow = titleRow + config.xHeaderRowOffset;
        const xDataStartRow = titleRow + config.xDataStartRowOffset;
        const yHeaderRow = titleRow + (config.yHeaderRowOffset ?? config.xHeaderRowOffset);
        const yDataStartRow = titleRow + (config.yDataStartRowOffset ?? config.xDataStartRowOffset);
        const xLabel = this.readCurveAxisLabel(xHeaderRow, 6) || 'X';
        const yLabel = config.yHeaderRowOffset !== undefined
            ? (this.readRowTitle(yHeaderRow, 7) || 'Y')
            : (this.readCurveAxisLabel(xHeaderRow, 22) || 'Y');
        const xRows = this.readCurveRows(xDataStartRow, cleanColEntries, 6);
        const yRows = config.yHeaderRowOffset !== undefined
            ? this.readCurveRows(yDataStartRow, cleanColEntries, 7)
            : this.readCurveRows(xDataStartRow, cleanColEntries, 7);
        const xUnit = this.extractCurveUnit(xRows);
        const yUnit = this.extractCurveUnit(yRows);
        const results = new Map();
        for (const variantEntry of cleanColEntries) {
            const points = this.buildCurvePointsForVariant(xRows, yRows, variantEntry.col);
            if (points.length === 0)
                continue;
            results.set(variantEntry.name, {
                xLabel,
                yLabel,
                xUnit,
                yUnit,
                points
            });
        }
        return results;
    }
    buildCurvePointsForVariant(xRows, yRows, variantCol) {
        const points = [];
        const rowCount = Math.min(xRows.length, yRows.length);
        for (let i = 0; i < rowCount; i++) {
            const x = this.toNumericValue(xRows[i].values.get(variantCol) ?? xRows[i].baseValue);
            const y = this.toNumericValue(yRows[i].values.get(variantCol) ?? yRows[i].baseValue);
            if (x === null || y === null)
                continue;
            points.push({
                x,
                y,
                label: xRows[i].lineLabel || yRows[i].lineLabel
            });
        }
        return points;
    }
    findTitleRow(title) {
        const target = (0, text_norm_1.normalizeText)(title, 'strong');
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const cell = row[c];
                if (!cell)
                    continue;
                if ((0, text_norm_1.normalizeText)(String(cell), 'strong') === target) {
                    return r;
                }
            }
        }
        return -1;
    }
    readCurveAxisLabel(rowIndex, colIndex) {
        const value = this.rawData[rowIndex]?.[colIndex - 1];
        return value ? String(value).trim() : '';
    }
    readRowTitle(rowIndex, preferredCol) {
        const row = this.rawData[rowIndex] || [];
        const preferred = row[preferredCol - 1];
        if (preferred)
            return String(preferred).trim();
        for (const cell of row) {
            if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
                return String(cell).trim();
            }
        }
        return '';
    }
    extractCurveUnit(rows) {
        for (const row of rows) {
            if (row.unit)
                return row.unit;
        }
        return '';
    }
    readCurveRows(startRow, cleanColEntries, dataStartCol) {
        const rows = [];
        for (let r = startRow; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            const lineLabel = this.cellToString(row, dataStartCol - 2);
            if (!/^line\s+\d+/i.test(lineLabel)) {
                if (rows.length > 0)
                    break;
                continue;
            }
            const unit = this.cellToString(row, 21);
            const baseValue = row[dataStartCol - 1];
            const values = new Map();
            for (const entry of cleanColEntries) {
                values.set(entry.col, row[entry.col]);
            }
            rows.push({ lineLabel, baseValue, values, unit });
        }
        return rows;
    }
    toNumericValue(value) {
        if (value === undefined || value === null || value === '')
            return null;
        if (typeof value === 'number')
            return Number.isFinite(value) ? value : null;
        const parsed = Number(String(value).replace(',', '.').trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    readParamNameFromRow(row, paramCol) {
        if (paramCol !== null && paramCol !== undefined && paramCol < row.length) {
            const v = row[paramCol];
            if (this.isLikelyLabel(v))
                return String(v).trim();
        }
        for (let c = 0; c < Math.min(3, row.length); c++) {
            const v = row[c];
            if (this.isLikelyLabel(v))
                return String(v).trim();
        }
        return '';
    }
    isParametercheckRow(row) {
        const c = this.firstNonEmptyCol(row);
        if (c < 0)
            return false;
        const v = row[c];
        if (!v)
            return false;
        const norm = (0, text_norm_1.normalizeText)(String(v), 'strong');
        return norm.startsWith('parameterche'); // parametercheck + truncated
    }
    /**
     * Detect unit/check columns from actual data contents (NOT normalizeText, because "check" can be a stopword elsewhere)
     */
    refineColumns(headerRow, paramCol, commentCol, checkCol, unitCol, colMap) {
        const SAMPLE_ROWS = 50;
        const start = headerRow + 1;
        const end = Math.min(this.rawData.length, start + SAMPLE_ROWS);
        const colStats = new Map();
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
        const isUnitLike = (v) => {
            if (v === undefined || v === null)
                return false;
            const raw = String(v).trim();
            if (!raw)
                return false;
            const compact = raw.replace(/\s+/g, '');
            if (compact === '[-]' || compact === '-' || compact === '—')
                return true;
            const hasBrackets = /[\[\(\{].*[\]\)\}]/.test(compact);
            if (hasBrackets) {
                const inner = compact
                    .replace(/^[\[\(\{]/, '')
                    .replace(/[\]\)\}]$/, '')
                    .toLowerCase();
                if (UNIT_WHITELIST.has(inner))
                    return true;
                if (/^[-a-z0-9/%°]{1,12}$/i.test(inner) && /[a-z%°]/i.test(inner))
                    return true;
                return false;
            }
            const low = compact.toLowerCase();
            if (['check', 'status', 'ok', 'nok', 'na', 'n/a', 'yes', 'no'].includes(low))
                return false;
            return UNIT_WHITELIST.has(low);
        };
        const isCheckLike = (v) => {
            if (v === undefined || v === null)
                return false;
            const s = String(v).trim().toLowerCase();
            if (!s)
                return false;
            return ['ok', 'nok', 'na', 'n/a', 'check', 'status', 'yes', 'no'].includes(s);
        };
        for (let r = start; r < end; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (v === undefined || v === null || String(v).trim() === '')
                    continue;
                const st = colStats.get(c) ?? { nonEmpty: 0, unitLike: 0, checkLike: 0 };
                st.nonEmpty += 1;
                if (isUnitLike(v))
                    st.unitLike += 1;
                if (isCheckLike(v))
                    st.checkLike += 1;
                colStats.set(c, st);
            }
        }
        const bestByRatio = (kind, preferNear) => {
            let bestCol = null;
            let bestScore = 0;
            for (const [c, st] of colStats.entries()) {
                if (st.nonEmpty < 6)
                    continue;
                const ratio = st[kind] / st.nonEmpty;
                if (ratio < 0.40)
                    continue;
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
        // Do NOT overwrite if header already found a column
        const inferredUnitCol = unitCol !== null && unitCol !== undefined ? unitCol : bestByRatio('unitLike', paramCol);
        const inferredCheckCol = checkCol !== null && checkCol !== undefined ? checkCol : bestByRatio('checkLike', inferredUnitCol ?? paramCol);
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
    isCategoryRow(row) {
        const nonEmptyIdx = this.firstNonEmptyCol(row);
        if (nonEmptyIdx === -1)
            return false;
        const label = row[nonEmptyIdx];
        if (!this.isLikelyLabel(label))
            return false;
        for (let c = 0; c < row.length; c++) {
            if (c === nonEmptyIdx)
                continue;
            const v = row[c];
            if (v !== undefined && v !== null && String(v).trim() !== '')
                return false;
        }
        return true;
    }
    firstNonEmptyCol(row) {
        for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v !== undefined && v !== null && String(v).trim() !== '')
                return c;
        }
        return -1;
    }
    extractVariantNames() {
        let startRow = -1;
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v)
                    continue;
                const s = (0, text_norm_1.normalizeText)(String(v), 'strong');
                if (s.includes('customer platform variants')) {
                    startRow = r;
                    break;
                }
            }
            if (startRow >= 0)
                break;
        }
        if (startRow < 0)
            return [];
        let headerRow = -1;
        let nameCol = -1;
        for (let r = startRow; r < Math.min(startRow + 12, this.rawData.length); r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v)
                    continue;
                const s = (0, text_norm_1.normalizeText)(String(v), 'strong');
                if (s === 'name') {
                    headerRow = r;
                    nameCol = c;
                    break;
                }
            }
            if (headerRow >= 0)
                break;
        }
        if (headerRow < 0 || nameCol < 0)
            return [];
        const variants = [];
        let emptyStreak = 0;
        for (let r = headerRow + 1; r < Math.min(headerRow + 300, this.rawData.length); r++) {
            const row = this.rawData[r] || [];
            const v = row[nameCol];
            const name = v !== undefined && v !== null ? String(v).trim() : '';
            if (!name) {
                emptyStreak += 1;
                if (emptyStreak >= 8)
                    break;
                continue;
            }
            emptyStreak = 0;
            if ((0, text_norm_1.normalizeText)(name, 'strong').includes('attention'))
                continue;
            variants.push(name);
        }
        return Array.from(new Set(variants));
    }
    findMatrixHeaderRow(variants) {
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            let matches = 0;
            const colMap = {};
            let paramCol = null;
            let commentCol = null;
            let checkCol = null;
            let unitCol = null;
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v)
                    continue;
                const cell = String(v).trim();
                if (!cell)
                    continue;
                const cellNorm = this.normHeader(cell);
                if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) {
                    paramCol = c;
                    continue;
                }
                if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS)) {
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
                for (const vn of variants) {
                    const sc = (0, text_norm_1.tokenSetRatio)(cell, vn);
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
    findHeaderRowByTokens() {
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            let paramCol = null;
            let commentCol = null;
            let checkCol = null;
            let unitCol = null;
            const colMap = {};
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v)
                    continue;
                const cell = String(v).trim();
                if (!cell)
                    continue;
                const cellNorm = this.normHeader(cell);
                if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS)) {
                    paramCol = c;
                    continue;
                }
                if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS)) {
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
            // Require at least one anchor (param or comment)
            if (paramCol === null && commentCol === null)
                continue;
            const startCol = Math.max(paramCol ?? -1, commentCol ?? -1, unitCol ?? -1, checkCol ?? -1) + 1;
            let found = 0;
            let emptyStreak = 0;
            for (let c = startCol; c < row.length; c++) {
                const cell = this.getHeaderCellValue(r, c, paramCol, false);
                if (!cell)
                    continue;
                const cellNorm = this.normHeader(cell);
                if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS))
                    continue;
                if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS))
                    continue;
                if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS))
                    continue;
                if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS))
                    continue;
                const normStrong = (0, text_norm_1.normalizeText)(cell, 'strong');
                if (ExcelExtractor.GARBAGE_LABELS.has(normStrong))
                    continue;
                colMap[c] = cell;
                found += 1;
                emptyStreak = 0;
                if (found >= 12)
                    break;
            }
            if (found < 1) {
                for (let c = startCol; c < row.length; c++) {
                    const cell = this.getHeaderCellValue(r, c, paramCol, true);
                    if (!cell) {
                        emptyStreak += 1;
                        if (emptyStreak >= 5)
                            break;
                        continue;
                    }
                    const cellNorm = this.normHeader(cell);
                    if (this.tokenMatches(cellNorm, ExcelExtractor.PARAM_TOKENS))
                        continue;
                    if (this.tokenMatches(cellNorm, ExcelExtractor.CHECK_TOKENS))
                        continue;
                    if (this.tokenMatches(cellNorm, ExcelExtractor.COMMENT_TOKENS))
                        continue;
                    if (this.tokenMatches(cellNorm, ExcelExtractor.UNIT_TOKENS))
                        continue;
                    const normStrong = (0, text_norm_1.normalizeText)(cell, 'strong');
                    if (ExcelExtractor.GARBAGE_LABELS.has(normStrong))
                        continue;
                    colMap[c] = cell;
                    found += 1;
                    if (found >= 12)
                        break;
                }
            }
            if (Object.keys(colMap).length >= 1) {
                return { headerRow: r, colMap, paramCol, commentCol, checkCol, unitCol };
            }
        }
        return null;
    }
    getHeaderCellValue(rowIndex, colIndex, _paramCol, preferBelow) {
        const primaryRow = preferBelow ? rowIndex + 1 : rowIndex;
        const secondaryRow = preferBelow ? rowIndex : rowIndex + 1;
        const v1 = this.rawData[primaryRow]?.[colIndex];
        if (v1 !== undefined && v1 !== null && String(v1).trim() !== '')
            return String(v1).trim();
        const v0 = this.rawData[secondaryRow]?.[colIndex];
        if (v0 !== undefined && v0 !== null && String(v0).trim() !== '')
            return String(v0).trim();
        return '';
    }
    cellToString(row, col) {
        if (col === null || col === undefined)
            return '';
        const v = row[col];
        if (v === undefined || v === null)
            return '';
        return String(v).trim();
    }
    normalizeCheckStatus(value) {
        const raw = String(value ?? '').trim();
        if (!raw)
            return '';
        const v = raw.toLowerCase();
        if (v === 'ok')
            return 'ok';
        if (v === 'nok' || v === 'not ok' || v === 'notok')
            return 'nok';
        if (v === 'na' || v === 'n a' || v === 'n/a')
            return 'na';
        // BSPA / Rulebook tokens
        if (v === 'r')
            return 'R';
        if (v === 'rd')
            return 'RD';
        if (v === 'o')
            return 'O';
        return raw;
    }
    // ===========================
    // PROJECT DESCRIPTION (OLD kept, plus small safety fixes)
    // ===========================
    extractProjectDescription() {
        const results = [];
        // 1) Find "project description"
        let startRow = -1;
        for (let r = 0; r < this.rawData.length; r++) {
            const row = this.rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (!v)
                    continue;
                const s = (0, text_norm_1.normalizeText)(String(v), 'strong');
                if (s.includes('project description')) {
                    startRow = r;
                    break;
                }
            }
            if (startRow >= 0)
                break;
        }
        if (startRow < 0)
            return [];
        // 2) Determine key/value columns (first row after header with >=2 non-empty cells)
        let keyCol = -1;
        let valueCol = -1;
        for (let r = startRow + 1; r < Math.min(startRow + 20, this.rawData.length); r++) {
            const row = this.rawData[r] || [];
            const nonEmpty = [];
            for (let c = 0; c < row.length; c++) {
                const s = String(row[c] ?? '').trim();
                if (s !== '')
                    nonEmpty.push(c);
            }
            if (nonEmpty.length >= 2) {
                keyCol = nonEmpty[0];
                valueCol = nonEmpty[1];
                break;
            }
        }
        if (keyCol < 0 || valueCol < 0)
            return [];
        // 3) Collect rows until empty / next section
        let emptyStreak = 0;
        for (let r = startRow + 1; r < Math.min(startRow + 300, this.rawData.length); r++) {
            const row = this.rawData[r] || [];
            const rowText = (row || []).map(x => (0, text_norm_1.normalizeText)(String(x ?? ''), 'strong')).join(' ');
            if (rowText.includes('customer platform variants'))
                break;
            if (rowText.startsWith('parameterche'))
                break;
            if (rowText.includes('parameter template'))
                break;
            const key = String(row[keyCol] ?? '').trim();
            const value = String(row[valueCol] ?? '').trim();
            if (!key && !value) {
                emptyStreak += 1;
                if (emptyStreak >= 6)
                    break;
                continue;
            }
            emptyStreak = 0;
            // Stop: don't include Premises
            const keyNorm = (0, text_norm_1.normalizeText)(key, 'strong');
            if (keyNorm === 'premises' || keyNorm.startsWith('premis')) {
                break;
            }
            if (!this.isLikelyLabel(key))
                continue;
            results.push({ key, value });
        }
        // De-duplicate
        const seen = new Set();
        return results.filter(it => {
            const k = (0, text_norm_1.normalizeText)(it.key, 'strong');
            if (!k || seen.has(k))
                return false;
            seen.add(k);
            return true;
        });
    }
    // ===========================
    // Category context logic (OLD kept)
    // ===========================
    prevRowIsCategorySeparator(prevRow) {
        if (!prevRow || prevRow.length === 0)
            return false;
        for (const cell of prevRow) {
            if (cell === undefined || cell === null)
                continue;
            const s = String(cell).trim();
            if (!s)
                continue;
            const norm = (0, text_norm_1.normalizeText)(s, 'strong');
            if (norm.startsWith('parameterche'))
                return true;
            if (this.tokenMatches(norm, ExcelExtractor.COMMENT_TOKENS))
                return true;
            if (this.tokenMatches(norm, ExcelExtractor.UNIT_TOKENS))
                return true;
            if (this.tokenMatches(norm, ExcelExtractor.CHECK_TOKENS))
                return true;
            if (this.tokenMatches(norm, ExcelExtractor.PARAM_TOKENS))
                return true;
        }
        return false;
    }
    isCategoryRowWithContext(row, prevRow) {
        if (!this.isCategoryRow(row))
            return false;
        return this.prevRowIsCategorySeparator(prevRow);
    }
}
exports.ExcelExtractor = ExcelExtractor;
// === Old robust constants (kept) ===
ExcelExtractor.MIN_MATCH_SCORE = 88;
ExcelExtractor.MAX_LABEL_CHARS = 80;
ExcelExtractor.MAX_LABEL_TOKENS = 10;
ExcelExtractor.VARIANT_HEADER_MATCH = 85;
ExcelExtractor.GARBAGE_LABELS = new Set([
    'parameter', 'parameters', 'unit', 'units', 'comment', 'comments',
    'check', 'status', 'project', 'customer', 'description', 'variant',
    'value', 'werte', 'wert'
]);
ExcelExtractor.PARAM_TOKENS = ['parametercheck', 'parameter check', 'parameter', 'param'];
ExcelExtractor.COMMENT_TOKENS = ['free text', 'free-text', 'freetext', 'comment', 'comments', 'kommentar', 'bemerkung'];
ExcelExtractor.UNIT_TOKENS = ['unit', 'units', 'einheit'];
ExcelExtractor.CHECK_TOKENS = ['check', 'status'];
