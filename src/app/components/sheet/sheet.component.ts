import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService, WorkflowStep } from '../../services/data.service';

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
        if (!this.epcNumber || this.epcValues[paramId] === undefined) return false;
        const currentVal = this.dataService.variants[0].values[paramId]?.value;
        const epcVal = this.epcValues[paramId];
        return String(currentVal ?? '').trim() !== String(epcVal ?? '').trim();
    }

    updateParamValue(paramId: string, newValue: any, variantId?: string) {
        if (this.dataService.variants.length === 0) return;

        const targetId = variantId || this.dataService.variants[0].id;
        const variant = this.dataService.variants.find(v => v.id === targetId);
        if (!variant) return;

        const existing = variant.values[paramId];

        if (existing) {
            existing.value = newValue;
            existing.isMissing = newValue === '' || newValue === null || newValue === undefined;
            if (!existing.isMissing) existing.source = 'Manual';
        } else {
            this.dataService.setParameterValue(targetId, paramId, newValue, 'Manual');
        }
    }

    autofillDefaults() {
        const variants = this.dataService.variants;
        if (!variants.length) return;

        this.dataService.parameterGroups.forEach(group => {
            group.parameters.forEach(param => {
                if (param.defaultValue === undefined) return;
                variants.forEach(v => {
                    if (this.isMissingForVariant(v.id, param.id)) {
                        this.dataService.setParameterValue(v.id, param.id, param.defaultValue, 'Estimation', 4);
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
                        this.dataService.setParameterValue(v.id, param.id, value, source, source === 'Imported' ? 5 : 4);
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
