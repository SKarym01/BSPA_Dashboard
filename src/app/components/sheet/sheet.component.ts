import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CurveValue, DataService, ParameterRow, TrustLevel, WorkflowStep } from '../../services/data.service';
import { RoleFeature, RoleService } from '../../services/role.service';

@Component({
    selector: 'app-sheet',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sheet.component.html',
})
export class SheetComponent implements OnInit {
    private readonly curvePalette = ['#2563eb', '#0f766e', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#4f46e5'];
    private readonly chartBounds = {
        left: 78,
        right: 902,
        top: 24,
        bottom: 356,
        width: 824,
        height: 332,
    };
    activeCurveSelectorParamId: string | null = null;
    activeFullscreenCurveParamId: string | null = null;
    private readonly selectedCurveVariants = new Map<string, Set<string>>();
    private readonly curveChartCache = new Map<string, {
        xLabel: string;
        yLabel: string;
        series: Array<{ id: string; name: string; color: string; path: string; pointCount: number; points: CurvePointView[] }>;
        xTicks: number[];
        yTicks: number[];
    } | null>();
    private readonly curveMatrixCache = new Map<string, {
        xLabel: string;
        yLabel: string;
        variants: Array<{ id: string; name: string; color: string }>;
        rows: Array<{ index: number; label: string; x: number | ''; values: Record<string, number | ''> }>;
    } | null>();
    private curveCacheRevision = 0;
    userRole: 'expert' | 'standard' = 'expert';
    epcNumber: string = '';
    epcValues: { [paramId: string]: any } = {};
    currentStep: WorkflowStep = 'INPUT_SHEET';
    workflowSteps: WorkflowStep[] = ['CUSTOMER_DATA', 'INPUT_SHEET', 'MAMBA', 'RESULTS'];
    private activeInputTarget: { paramId: string; variantId: string } | null = null;

    trustLevelOptions: TrustLevel[] = [
        'Not set',
        'Design value',
        'Estimation',
        'From customer',
        'Imported',
        'From EPC',
    ];

    constructor(
        public dataService: DataService,
        public roleService: RoleService,
        private router: Router
    ) { }

    can(feature: RoleFeature): boolean {
        return this.roleService.can(feature);
    }

    ngOnInit(): void {
        this.dataService.updateWorkflowStep('INPUT_SHEET');
        this.dataService.currentWorkflowStep$.subscribe(step => {
            this.currentStep = step;
        });
        this.epcNumber = this.dataService.projectData.epcNumber || '';
        this.expandImportedCurveGroups();
        if (this.epcNumber) this.loadEpcData();
    }

    stepIndex(step: WorkflowStep): number {
        return this.workflowSteps.indexOf(step);
    }

    isStepActive(step: WorkflowStep): boolean {
        return this.currentStep === step;
    }

    isStepCompleted(step: WorkflowStep): boolean {
        return this.stepIndex(step) < this.stepIndex(this.currentStep);
    }

    collapsedGroups = new Set<string>();
    expandedCurves = new Set<string>();

    toggleGroup(groupName: string) {
        if (this.collapsedGroups.has(groupName)) {
            this.collapsedGroups.delete(groupName);
        } else {
            this.collapsedGroups.add(groupName);
        }
    }

    isGroupCollapsed(groupName: string): boolean {
        return this.collapsedGroups.has(groupName);
    }

    toggleCurve(paramId: string) {
        if (this.expandedCurves.has(paramId)) {
            this.expandedCurves.delete(paramId);
        } else {
            this.expandedCurves.add(paramId);
        }
    }

    isCurveExpanded(paramId: string): boolean {
        return this.expandedCurves.has(paramId);
    }

    openCurveFullscreen(paramId: string, event?: Event): void {
        event?.stopPropagation();
        this.activeFullscreenCurveParamId = paramId;
    }

    closeCurveFullscreen(event?: Event): void {
        event?.stopPropagation();
        this.activeFullscreenCurveParamId = null;
    }

    isCurveFullscreen(paramId: string): boolean {
        return this.activeFullscreenCurveParamId === paramId;
    }

    private expandImportedCurveGroups(): void {
        this.expandedCurves.clear();
        for (const group of this.dataService.parameterGroups) {
            for (const param of group.parameters) {
                if (param.type === 'curve') {
                    this.expandedCurves.add(param.id);
                }
            }
        }
    }

    loadEpcData() {
        if (!this.epcNumber) return;
        this.epcValues = this.dataService.getMockEpcData(this.epcNumber);
    }

    isMissing(paramId: string): boolean {
        if (this.dataService.variants.length === 0) return true;
        return this.isMissingForVariant(this.dataService.variants[0].id, paramId);
    }

    isMissingForVariant(variantId: string, paramId: string): boolean {
        const variant = this.dataService.variants.find(v => v.id === variantId);
        if (!variant) return true;
        const val = variant.values[paramId];
        return !val || val.value === '' || val.value === undefined || val.value === null;
    }

    isEpcMismatch(paramId: string): boolean {
        if (this.epcValues[paramId] === undefined) return false;
        const currentVal = this.dataService.variants[0].values[paramId]?.value;
        const epcVal = this.epcValues[paramId];
        return String(currentVal ?? '').trim() !== String(epcVal ?? '').trim();
    }

    isEpcMismatchForVariant(variantId: string, paramId: string): boolean {
        if (this.epcValues[paramId] === undefined) return false;
        const variant = this.dataService.variants.find(v => v.id === variantId);
        if (!variant) return false;
        const currentVal = variant.values[paramId]?.value;
        const epcVal = this.epcValues[paramId];
        return String(currentVal ?? '').trim() !== String(epcVal ?? '').trim();
    }

    isEpcMismatchAnyVariant(paramId: string): boolean {
        if (this.epcValues[paramId] === undefined) return false;
        return this.dataService.variants.some(v => this.isEpcMismatchForVariant(v.id, paramId));
    }



    updateParamValue(paramId: string, newValue: any, variantId?: string) {
        if (!this.can('edit_parameter_values')) return;
        if (this.dataService.variants.length === 0) return;

        const targetId = variantId || this.dataService.variants[0].id;
        if (this.isValueLockedForCurrentRole(paramId, targetId)) return;
        const variant = this.dataService.variants.find(v => v.id === targetId);
        if (!variant) return;

        const existing = variant.values[paramId];
        const isMissing = newValue === '' || newValue === null || newValue === undefined;

        if (existing) {
            existing.value = newValue;
            existing.isMissing = isMissing;

            if (existing.isMissing) {
                existing.trustLevel = undefined;
                return;
            }

            existing.source = 'Manual';

            const shouldResetTrustLevel =
                !existing.trustLevel || ['Imported', 'From EPC', 'Estimation'].includes(existing.trustLevel);
            if (shouldResetTrustLevel) existing.trustLevel = 'Not set';
        } else {
            this.dataService.setParameterValue(
                targetId,
                paramId,
                newValue,
                'Manual',
                isMissing ? undefined : 'Not set'
            );
        }
    }

    setActiveInput(paramId: string, variantId?: string): void {
        const targetId = variantId || this.dataService.variants[0]?.id;
        if (!targetId) return;
        this.activeInputTarget = { paramId, variantId: targetId };
    }

    updateTrustLevel(paramId: string, trustLevel: TrustLevel, variantId?: string) {
        if (!this.can('edit_trust_level')) return;
        if (this.dataService.variants.length === 0) return;

        const targetId = variantId || this.dataService.variants[0].id;
        const variant = this.dataService.variants.find(v => v.id === targetId);
        if (!variant) return;

        const existing = variant.values[paramId];
        if (!existing || existing.isMissing) return;

        const currentTrust = existing.trustLevel ?? 'Not set';
        const touchesDesignValue = currentTrust === 'Design value' || trustLevel === 'Design value';

        if (touchesDesignValue && !this.canEditDesignValue()) return;
        if (trustLevel === 'Design value' && !this.isDesignValueLockApplicable(paramId)) return;

        existing.trustLevel = trustLevel;
    }

    isTrustLevelSelectorDisabled(
        paramId: string,
        isMissing: boolean,
        currentTrustLevel?: TrustLevel
    ): boolean {
        if (isMissing || !this.can('edit_trust_level')) return true;
        return currentTrustLevel === 'Design value' && !this.canEditDesignValue();
    }

    isDesignValueOptionDisabled(paramId: string): boolean {
        if (!this.isDesignValueLockApplicable(paramId)) return true;
        return !this.canEditDesignValue();
    }

    isValueLockedForCurrentRole(paramId: string, variantId?: string): boolean {
        const targetId = variantId || this.dataService.variants[0]?.id;
        if (!targetId || this.roleService.selectedRole !== 'TPM_CUSTOMER_TEAM') return false;
        const variant = this.dataService.variants.find(v => v.id === targetId);
        const trust = variant?.values[paramId]?.trustLevel;
        return trust === 'Design value';
    }

    private canEditDesignValue(): boolean {
        return this.roleService.selectedRole === 'BSPA_COORDINATION' && this.can('toggle_design_value_lock');
    }

    private isDesignValueLockApplicable(paramId: string): boolean {
        const param = this.findParameter(paramId);
        if (!param) return false;
        if (param.type === 'curve') return false;
        if (this.roleService.selectedRole === 'BSPA_COORDINATION') return true;
        return param.mandatoryStatus === 'mandatory' || param.mandatoryStatus === 'semi-mandatory';
    }

    private findParameter(paramId: string): ParameterRow | undefined {
        for (const group of this.dataService.parameterGroups) {
            const match = group.parameters.find(p => p.id === paramId);
            if (match) return match;
        }
        return undefined;
    }

    curveParameterName(paramId: string): string {
        return this.findParameter(paramId)?.name || paramId;
    }

    badgeLabel(value: any): string {
        const isMissing = !value || value.isMissing || value.value === '' || value.value === undefined || value.value === null;
        if (isMissing) return 'NOT SET';

        const trustLevel = value?.trustLevel;
        if (trustLevel && trustLevel !== 'Not set') return String(trustLevel).toUpperCase();
        const source = value?.source || 'MANUAL';
        return String(source).toUpperCase();
    }

    badgeClass(value: any): string {
        const isMissing = !value || value.isMissing || value.value === '' || value.value === undefined || value.value === null;
        if (isMissing) return 'bg-slate-50 border border-slate-200 text-slate-500';

        const trustLevel = value?.trustLevel;
        const label = trustLevel && trustLevel !== 'Not set' ? trustLevel : (value?.source || 'Manual');

        if (label === 'Imported') return 'bg-blue-50 border border-blue-100 text-blue-600';
        if (label === 'Estimation') return 'bg-purple-50 border border-purple-100 text-purple-600';
        if (label === 'Design value') return 'bg-amber-50 border border-amber-100 text-amber-700';
        if (label === 'From EPC') return 'bg-emerald-50 border border-emerald-100 text-emerald-700';
        if (label === 'From customer') return 'bg-sky-50 border border-sky-100 text-sky-700';

        return 'bg-white';
    }

    autofillDefaults() {
        if (!this.can('autofill_defaults')) return;
        const variants = this.dataService.variants;
        if (!variants.length) return;

        this.dataService.parameterGroups.forEach(group => {
            group.parameters.forEach(param => {
                variants.forEach(v => {
                    const currentVal = v.values[param.id];
                    if (!currentVal || currentVal.value === '' || currentVal.value === undefined || currentVal.value === null) {
                        let fillVal: any = null;
                        if (param.type === 'number') fillVal = (Math.random() * 80 + 5).toFixed(2);
                        else if (param.type === 'curve') fillVal = 'Autofilled Curve Data';
                        else fillVal = 'Autofill-Text';

                        this.dataService.setParameterValue(v.id, param.id, fillVal, 'Manual', 'Estimation');
                    }
                });
            });
        });
    }

    runAiEstimation() {
        if (!this.can('ai_estimate')) return;
        if (!this.activeInputTarget) {
            alert('Please place the cursor in a field first.');
            return;
        }
        const applied = this.dataService.estimateValueForField(
            this.activeInputTarget.variantId,
            this.activeInputTarget.paramId
        );
        if (!applied) {
            alert('AI estimation only works for an empty text/number field.');
        }
    }

    saveAsDraft() {
        if (!this.can('save_draft')) return;
        const newDraft: any = {
            id: 'd-' + Date.now(),
            name: this.dataService.projectData.epcNumber ? `EPC: ${this.dataService.projectData.epcNumber}` : 'Untitled Project',
            epc: this.dataService.projectData.epcNumber || 'N/A',
            lastModified: new Date(),
            status: 'Draft'
        };

        this.dataService.drafts.unshift(newDraft);
        this.dataService.resetProjectData();
        this.router.navigate(['/']);
    }

    startBspa() {
        if (!this.can('start_bspa')) return;
        const missingParams = this.dataService.validateForMamba();
        if (missingParams.length > 0) {
            alert('Please fill in the following MANDATORY (Red) fields before starting BSPA:\n\n- ' + missingParams.join('\n- '));
            return;
        }

        this.dataService.pendingStartBspa = true;
        this.dataService.updateWorkflowStep('INPUT_SHEET');
        this.router.navigate(['/new']);
    }

    getCurveValue(variantId: string, paramId: string): CurveValue | null {
        const variant = this.dataService.variants.find(v => v.id === variantId);
        const value = variant?.values[paramId]?.value;
        return this.isCurveValue(value) ? value : null;
    }

    getCurveChart(paramId: string): {
        xLabel: string;
        yLabel: string;
        series: Array<{ id: string; name: string; color: string; path: string; pointCount: number; points: CurvePointView[] }>;
        xTicks: number[];
        yTicks: number[];
    } | null {
        const cacheKey = this.curveCacheKey(paramId);
        if (this.curveChartCache.has(cacheKey)) {
            return this.curveChartCache.get(cacheKey) ?? null;
        }

        const series = this.dataService.variants
            .filter(variant => this.isCurveVariantVisible(paramId, variant.id))
            .map(variant => {
                const curve = this.getCurveValue(variant.id, paramId);
                if (!curve || curve.points.length === 0) return null;
                return {
                    id: variant.id,
                    name: variant.name,
                    color: this.curveVariantColor(paramId, variant.id),
                    curve
                };
            })
            .filter((entry): entry is { id: string; name: string; color: string; curve: CurveValue } => entry !== null);

        if (series.length === 0) {
            this.curveChartCache.set(cacheKey, null);
            return null;
        }

        const allPoints = series.flatMap(entry => entry.curve.points);
        const xValues = allPoints.map(point => point.x);
        const yValues = allPoints.map(point => point.y);

        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);

        const xRange = xMax - xMin || 1;
        const yRange = yMax - yMin || 1;

        const projectX = (value: number) => this.chartBounds.left + ((value - xMin) / xRange) * this.chartBounds.width;
        const projectY = (value: number) => this.chartBounds.bottom - ((value - yMin) / yRange) * this.chartBounds.height;

        const chart = {
            xLabel: this.formatAxisLabel(series[0].curve.xLabel),
            yLabel: this.formatAxisLabel(series[0].curve.yLabel),
            series: series.map(entry => ({
                id: entry.id,
                name: entry.name,
                color: entry.color,
                path: entry.curve.points.map(point => `${projectX(point.x)},${projectY(point.y)}`).join(' '),
                pointCount: entry.curve.points.length,
                points: entry.curve.points.map(point => ({
                    label: point.label ?? '',
                    x: point.x,
                    y: point.y
                }))
            })),
            xTicks: this.buildTicks(xMin, xMax),
            yTicks: this.buildTicks(yMin, yMax)
        };
        this.curveChartCache.set(cacheKey, chart);
        return chart;
    }

    getCurveMatrix(paramId: string): {
        xLabel: string;
        yLabel: string;
        variants: Array<{ id: string; name: string; color: string }>;
        rows: Array<{ index: number; label: string; x: number | ''; values: Record<string, number | ''> }>;
    } | null {
        const cacheKey = this.curveCacheKey(paramId);
        if (this.curveMatrixCache.has(cacheKey)) {
            return this.curveMatrixCache.get(cacheKey) ?? null;
        }

        const visibleVariants = this.dataService.variants
            .filter(variant => this.isCurveVariantVisible(paramId, variant.id))
            .map(variant => ({
                id: variant.id,
                name: variant.name,
                color: this.curveVariantColor(paramId, variant.id),
                curve: this.getCurveValue(variant.id, paramId)
            }))
            .filter((variant): variant is { id: string; name: string; color: string; curve: CurveValue } => !!variant.curve);

        if (visibleVariants.length === 0) {
            this.curveMatrixCache.set(cacheKey, null);
            return null;
        }

        const baseCurve = visibleVariants[0].curve;
        const rowCount = Math.max(...visibleVariants.map(variant => variant.curve.points.length));

        const rows: Array<{ index: number; label: string; x: number | ''; values: Record<string, number | ''> }> = Array.from({ length: rowCount }, (_, index) => {
            const basePoint = baseCurve.points[index];
            const values: Record<string, number | ''> = {};
            const xValue = basePoint ? Number(basePoint.x) : NaN;

            for (const variant of visibleVariants) {
                const point = variant.curve.points[index];
                values[variant.id] = point ? point.y : '';
            }

            return {
                index,
                label: basePoint?.label || `${index + 1}`,
                x: Number.isFinite(xValue) ? xValue : '',
                values
            };
        });

        const matrix = {
            xLabel: this.formatAxisLabel(baseCurve.xLabel),
            yLabel: this.formatAxisLabel(baseCurve.yLabel),
            variants: visibleVariants.map(({ id, name, color }) => ({ id, name, color })),
            rows
        };
        this.curveMatrixCache.set(cacheKey, matrix);
        return matrix;
    }

    axisX(value: number, ticks: number[]): number {
        const min = Math.min(...ticks);
        const max = Math.max(...ticks);
        const range = max - min || 1;
        return this.chartBounds.left + ((value - min) / range) * this.chartBounds.width;
    }

    axisY(value: number, ticks: number[]): number {
        const min = Math.min(...ticks);
        const max = Math.max(...ticks);
        const range = max - min || 1;
        return this.chartBounds.bottom - ((value - min) / range) * this.chartBounds.height;
    }

    formatTick(value: number): string {
        if (Math.abs(value) >= 100 || Number.isInteger(value)) return value.toFixed(0);
        if (Math.abs(value) >= 10) return value.toFixed(1);
        return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }

    toggleCurveSelector(paramId: string): void {
        this.activeCurveSelectorParamId = this.activeCurveSelectorParamId === paramId ? null : paramId;
    }

    isCurveSelectorOpen(paramId: string): boolean {
        return this.activeCurveSelectorParamId === paramId;
    }

    toggleCurveVariant(paramId: string, variantId: string, event?: Event): void {
        event?.stopPropagation();

        const visibleVariants = this.getOrCreateVisibleCurveVariants(paramId);
        if (visibleVariants.has(variantId)) {
            if (visibleVariants.size === 1) return;
            visibleVariants.delete(variantId);
            this.invalidateCurveCaches();
            return;
        }

        visibleVariants.add(variantId);
        this.invalidateCurveCaches();
    }

    isCurveVariantVisible(paramId: string, variantId: string): boolean {
        return this.getOrCreateVisibleCurveVariants(paramId).has(variantId);
    }

    curveVariantColor(paramId: string, variantId: string): string {
        const index = this.dataService.variants.findIndex(variant => variant.id === variantId);
        return this.curvePalette[(index >= 0 ? index : 0) % this.curvePalette.length];
    }

    curveVariantTone(paramId: string, variantId: string): { bg: string; border: string; text: string } {
        const tones = [
            { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
            { bg: '#ccfbf1', border: '#5eead4', text: '#0f766e' },
            { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
            { bg: '#f3e8ff', border: '#d8b4fe', text: '#7e22ce' },
            { bg: '#ffedd5', border: '#fdba74', text: '#c2410c' },
            { bg: '#cffafe', border: '#67e8f9', text: '#0e7490' },
            { bg: '#e0e7ff', border: '#a5b4fc', text: '#4338ca' }
        ];
        const index = this.dataService.variants.findIndex(variant => variant.id === variantId);
        return tones[(index >= 0 ? index : 0) % tones.length];
    }

    private buildTicks(min: number, max: number): number[] {
        if (min === max) return [min, min + 1];
        const tickCount = 5;
        return Array.from({ length: tickCount }, (_, index) => min + ((max - min) / (tickCount - 1)) * index);
    }

    updateCurveXAxis(paramId: string, rowIndex: number, newValue: string): void {
        if (!this.can('edit_parameter_values')) return;
        if (this.dataService.variants.some(v => this.isValueLockedForCurrentRole(paramId, v.id))) return;
        const parsedValue = this.parseCurveNumber(newValue);
        if (parsedValue === null) return;

        for (const variant of this.dataService.variants) {
            const curve = this.getCurveValue(variant.id, paramId);
            if (!curve || !curve.points[rowIndex]) continue;
            curve.points[rowIndex].x = parsedValue;
            this.markCurveAsManual(variant.id, paramId);
        }
        this.invalidateCurveCaches();
    }

    updateCurveYAxis(paramId: string, variantId: string, rowIndex: number, newValue: string): void {
        if (!this.can('edit_parameter_values')) return;
        if (this.isValueLockedForCurrentRole(paramId, variantId)) return;
        const parsedValue = this.parseCurveNumber(newValue);
        if (parsedValue === null) return;

        const curve = this.getCurveValue(variantId, paramId);
        if (!curve || !curve.points[rowIndex]) return;

        curve.points[rowIndex].y = parsedValue;
        this.markCurveAsManual(variantId, paramId);
        this.invalidateCurveCaches();
    }

    curveGridTemplate(variantCount: number): string {
        return `130px 140px repeat(${variantCount}, minmax(140px, 1fr))`;
    }

    private markCurveAsManual(variantId: string, paramId: string): void {
        const variant = this.dataService.variants.find(v => v.id === variantId);
        const existing = variant?.values[paramId];
        if (!existing) return;
        existing.source = 'Manual';
        if (!existing.trustLevel || ['Imported', 'From EPC', 'Estimation'].includes(existing.trustLevel)) {
            existing.trustLevel = 'Not set';
        }
        existing.isMissing = false;
    }

    private parseCurveNumber(rawValue: string): number | null {
        const normalizedValue = String(rawValue ?? '').trim().replace(',', '.');
        if (!normalizedValue) return null;
        const parsedValue = Number(normalizedValue);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    private curveCacheKey(paramId: string): string {
        const visible = [...this.getOrCreateVisibleCurveVariants(paramId)].sort().join('|');
        return `${paramId}::${this.curveCacheRevision}::${visible}`;
    }

    private invalidateCurveCaches(): void {
        this.curveCacheRevision += 1;
        this.curveChartCache.clear();
        this.curveMatrixCache.clear();
    }

    private formatAxisLabel(label: string): string {
        return label.trim();
    }

    private isCurveValue(value: any): value is CurveValue {
        return !!value && Array.isArray(value.points);
    }

    private getOrCreateVisibleCurveVariants(paramId: string): Set<string> {
        let visibleVariants = this.selectedCurveVariants.get(paramId);
        if (!visibleVariants) {
            visibleVariants = new Set(this.dataService.variants.map(variant => variant.id));
            this.selectedCurveVariants.set(paramId, visibleVariants);
        }
        return visibleVariants;
    }
}

interface CurvePointView {
    label: string;
    x: number;
    y: number;
}
