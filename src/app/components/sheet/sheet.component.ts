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
        this.dataService.estimateMissingValues();
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
        const missingParams = this.dataService.validateForMamba();
        if (missingParams.length > 0) {
            alert('Please fill in the following MANDATORY (Red) fields before starting BSPA:\n\n- ' + missingParams.join('\n- '));
            return;
        }

        this.dataService.pendingStartBspa = true;
        this.dataService.updateWorkflowStep('INPUT_SHEET');
        this.router.navigate(['/new']);
    }
}
