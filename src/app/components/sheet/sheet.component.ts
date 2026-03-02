import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService, TrustLevel, WorkflowStep } from '../../services/data.service';

@Component({
    selector: 'app-sheet',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sheet.component.html',
})
export class SheetComponent implements OnInit {
    userRole: 'expert' | 'standard' = 'expert';
    epcNumber: string = '';
    epcValues: { [paramId: string]: any } = {};
    currentStep: WorkflowStep = 'INPUT_SHEET';
    workflowSteps: WorkflowStep[] = ['CUSTOMER_DATA', 'INPUT_SHEET', 'MAMBA', 'RESULTS'];

    trustLevelOptions: TrustLevel[] = [
        'Not set',
        'Design value',
        'Estimation',
        'From customer',
        'Imported',
        'From EPC',
    ];

    constructor(public dataService: DataService, private router: Router) { }

    ngOnInit(): void {
        this.dataService.updateWorkflowStep('INPUT_SHEET');
        this.dataService.currentWorkflowStep$.subscribe(step => {
            this.currentStep = step;
        });
        this.epcNumber = this.dataService.projectData.epcNumber || '';
        if (this.epcNumber) this.loadEpcData();
        this.applyDemoEpcValues();
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

    private applyDemoEpcValues() {
        this.dataService.parameterGroups.forEach(group => {
            group.parameters.forEach(param => {
                const baseVal = this.dataService.variants[0]?.values[param.id]?.value;
                this.epcValues[param.id] = this.createDemoEpcValue(baseVal, param.type);
            });
        });
    }

    private createDemoEpcValue(baseVal: any, type: string): any {
        if (type === 'number') {
            const baseNum = Number(baseVal);
            const fallback = Math.random() * 90 + 10;
            const seed = Number.isFinite(baseNum) ? baseNum : fallback;
            const factor = 0.9 + Math.random() * 0.2;
            return (seed * factor).toFixed(2);
        }

        if (baseVal !== undefined && baseVal !== null && String(baseVal).trim() !== '') {
            return Math.random() < 0.5 ? String(baseVal) : `${String(baseVal)} EPC`;
        }

        return `EPC-${Math.floor(Math.random() * 900 + 100)}`;
    }

    updateParamValue(paramId: string, newValue: any, variantId?: string) {
        if (this.dataService.variants.length === 0) return;

        const targetId = variantId || this.dataService.variants[0].id;
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

    updateTrustLevel(paramId: string, trustLevel: TrustLevel, variantId?: string) {
        if (this.dataService.variants.length === 0) return;

        const targetId = variantId || this.dataService.variants[0].id;
        const variant = this.dataService.variants.find(v => v.id === targetId);
        if (!variant) return;

        const existing = variant.values[paramId];
        if (!existing || existing.isMissing) return;

        existing.trustLevel = trustLevel;
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
        const variants = this.dataService.variants;
        if (!variants.length) return;

        this.dataService.parameterGroups.forEach(group => {
            group.parameters.forEach(param => {
                if (param.defaultValue === undefined) return;
                variants.forEach(v => {
                    if (this.isMissingForVariant(v.id, param.id)) {
                        this.dataService.setParameterValue(v.id, param.id, param.defaultValue, 'Manual', 'Design value');
                    }
                });
            });
        });
    }

    runAiEstimation() {
        this.dataService.estimateMissingValues();
    }

    demoMixValues() {
        const variants = this.dataService.variants;
        if (!variants.length) return;

        const fillChance = (status: string): number => {
            if (status === 'mandatory') return 0.75;
            if (status === 'semi-mandatory') return 0.6;
            return 0.4;
        };

        const pickSource = (): 'Manual' | 'Imported' | 'Estimation' => {
            const r = Math.random();
            if (r < 0.45) return 'Imported';
            if (r < 0.75) return 'Manual';
            return 'Estimation';
        };

        const randomValue = (param: any): any => {
            if (param.type === 'number') return (Math.random() * 90 + 10).toFixed(2);
            if (param.type === 'select') {
                const opts = param.options || [];
                return opts.length ? opts[Math.floor(Math.random() * opts.length)] : 'Option A';
            }
            return `Demo-${Math.floor(Math.random() * 90 + 10)}`;
        };

        this.dataService.parameterGroups.forEach(group => {
            group.parameters.forEach(param => {
                variants.forEach(v => {
                    const shouldFill = Math.random() < fillChance(param.mandatoryStatus);
                    if (shouldFill) {
                        const value = randomValue(param);
                        const source = pickSource();
                        const trustLevel: TrustLevel | undefined =
                            source === 'Imported' ? 'Imported' : (source === 'Estimation' ? 'Estimation' : 'Not set');
                        this.dataService.setParameterValue(v.id, param.id, value, source, trustLevel);
                    } else {
                        this.dataService.setParameterValue(v.id, param.id, '', 'Manual');
                    }
                });
            });
        });
    }

    saveAsDraft() {
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
        const isValid = this.dataService.validateForMamba();
        if (!isValid) {
            alert('Please fill in all MANDATORY (Red) fields before starting BSPA.');
            return;
        }

        this.dataService.pendingStartBspa = true;
        this.dataService.updateWorkflowStep('INPUT_SHEET');
        this.router.navigate(['/new']);
    }
}
