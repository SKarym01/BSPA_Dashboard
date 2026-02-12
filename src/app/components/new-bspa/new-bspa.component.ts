import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService, ParameterValue, WorkflowStep } from '../../services/data.service';
import { MambaService, MambaResult } from '../../services/mamba.service';
import { read, utils } from 'xlsx';
import { ExcelExtractor } from '../../utils/excel-extractor';


@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './new-bspa.component.html',
})
export class NewBspaComponent implements OnInit {

    // Workflow State
    currentStep: WorkflowStep = 'CUSTOMER_DATA';
    workflowSteps: WorkflowStep[] = ['CUSTOMER_DATA', 'INPUT_SHEET', 'MAMBA', 'RESULTS'];

    // UI State
    epcNumber: string = '';
    isSimulating = false;
    simulationResult: MambaResult | null = null;
    epcValues: { [paramId: string]: any } = {};

    @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

    constructor(
        public dataService: DataService,
        private mambaService: MambaService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.dataService.currentWorkflowStep$.subscribe(step => {
            this.currentStep = step;
            // Load EPC data when entering validation step if EPC exists
            if (step === 'INPUT_SHEET' && this.epcNumber) {
                this.loadEpcData();
            }
        });

        // Initialize state if needed
        if (this.dataService.variants.length === 0) {
            this.dataService.variants = [{ id: 'v1', name: 'Variant A', values: {} }];
        }

        // Load EPC from service if restarting
        this.epcNumber = this.dataService.projectData.epcNumber || '';
        if (this.epcNumber && this.currentStep === 'INPUT_SHEET') {
            this.loadEpcData();
        }
    }

    setStep(step: WorkflowStep) {
        // Sync epcNumber to service before moving, just in case
        if (this.epcNumber) this.dataService.projectData.epcNumber = this.epcNumber;
        this.dataService.updateWorkflowStep(step);
    }

    loadEpcData() {
        if (!this.epcNumber) return;
        this.epcValues = this.dataService.getMockEpcData(this.epcNumber);
    }

    isEpcMismatch(paramId: string): boolean {
        // If no EPC or no EPC value for this param, no mismatch can be determined
        if (!this.epcNumber || this.epcValues[paramId] === undefined) return false;

        const currentVal = this.dataService.variants[0].values[paramId]?.value;
        const epcVal = this.epcValues[paramId];

        // Match check (loose equality)
        return String(currentVal || '').trim() !== String(epcVal).trim();
    }

    goToHome() {
        this.router.navigate(['/']);
    }

    nextStep() {
        // Simple manual transition for "Skip Upload"
        if (this.currentStep === 'CUSTOMER_DATA') {
            this.setStep('INPUT_SHEET');
        }
    }

    /**
     * Checks if a parameter is missing based on ID
     */
    isMissing(paramId: string): boolean {
        if (this.dataService.variants.length === 0) return true;
        const val = this.dataService.variants[0].values[paramId];
        return !val || val.value === '' || val.value === undefined || val.value === null;
    }

    /**
     * Updates the value for a specific parameter.
     */
    updateParamValue(paramId: string, newValue: any) {
        if (this.dataService.variants.length === 0) return;

        const variantId = this.dataService.variants[0].id;
        const existing = this.dataService.variants[0].values[paramId];

        if (existing) {
            existing.value = newValue;
            existing.isMissing = newValue === '' || newValue === null || newValue === undefined;
            if (!existing.isMissing) existing.source = 'Manual';
        } else {
            // Initialize with Manual source
            this.dataService.setParameterValue(variantId, paramId, newValue, 'Manual');
        }
    }

    autofillDefaults() {
        this.dataService.parameterGroups.forEach(group => {
            group.parameters.forEach(param => {
                if (this.isMissing(param.id) && param.defaultValue !== undefined) {
                    this.updateParamValue(param.id, param.defaultValue);
                    // Override source to 'Default'
                    const val = this.dataService.variants[0].values[param.id];
                    if (val) val.source = 'Default';
                }
            });
        });
    }

    runAiEstimation() {
        this.dataService.estimateMissingValues();
    }

    saveAsDraft() {
        // Save to Drafts
        const newDraft: any = {
            id: 'd-' + Date.now(),
            name: this.epcNumber ? `EPC: ${this.epcNumber}` : 'Untitled Project',
            epc: this.epcNumber || 'N/A',
            lastModified: new Date(),
            status: 'Draft'
        };

        // In a real app, this would be a proper service method
        this.dataService.drafts.unshift(newDraft);
        this.dataService.resetProjectData(); // Clear current
        this.router.navigate(['/']); // Go Home
    }

    startBspa() {
        // 1. Check Mandatory Fields
        const missingMandatory = this.dataService.parameterGroups.some(group =>
            group.parameters.some(p => p.mandatoryStatus === 'mandatory' && this.isMissing(p.id))
        );

        if (missingMandatory) {
            alert('Please fill in all MANDATORY (Red) fields before starting BSPA.');
            return;
        }

        // 3. Update Service State
        this.dataService.projectData.epcNumber = this.epcNumber;

        // 4. Start Simulation
        this.setStep('MAMBA');
        this.isSimulating = true;

        // Mock Mamba Run
        this.mambaService.runSimulation(this.dataService.variants[0]).subscribe(result => {
            this.isSimulating = false;
            this.simulationResult = result;

            // Auto finish
            setTimeout(() => {
                this.setStep('RESULTS');
            }, 1000);
        });
    }

    uploadFile() {
        this.fileInputRef?.nativeElement.click();
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const fileReader = new FileReader();
        fileReader.onload = (e) => {
            try {
                const arrayBuffer = e.target?.result;
                const workbook = read(arrayBuffer);
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                const extractor = new ExcelExtractor(rawData);
                const results = extractor.extractAllParameters(this.dataService.parameterGroups);

                if (this.dataService.variants.length > 0) {
                    const variantId = this.dataService.variants[0].id;
                    results.forEach(res => {
                        this.dataService.setParameterValue(variantId, res.paramId, res.foundValue, 'Input Sheet');
                    });
                }

                // Move to next step if currently on Upload step
                if (this.currentStep === 'CUSTOMER_DATA') {
                    this.setStep('INPUT_SHEET');
                }

            } catch (err) {
                console.error('Error parsing Excel file:', err);
                alert('Error reading Excel file.');
            }
        };
        fileReader.readAsArrayBuffer(file);
        input.value = '';
    }
}
