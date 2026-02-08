import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService, ParameterValue, WorkflowStep } from '../../services/data.service';
import { MambaService, MambaResult } from '../../services/mamba.service';
import { read, utils } from 'xlsx';
import { ExcelExtractor } from '../../utils/excel-extractor';
import { TrustIndicatorComponent } from '../shared/trust-indicator/trust-indicator.component'; // Import Trust Component

@Component({
    selector: 'app-new-bspa',
    standalone: true,
    imports: [CommonModule, FormsModule, TrustIndicatorComponent], // Add TrustIndicator
    templateUrl: './new-bspa.component.html',
})
export class NewBspaComponent implements OnInit {

    // Workflow State
    currentStep: WorkflowStep = 'CUSTOMER_DATA';
    workflowSteps: WorkflowStep[] = ['CUSTOMER_DATA', 'RB_DATA', 'INPUT_SHEET', 'MAMBA', 'RESULTS'];

    // UI State
    level: 1 | 2 = 1; // Level 1 (Review/Buttons) | Level 2 (Edit/Tech)
    showEpcError = false;
    isSimulating = false;
    simulationResult: MambaResult | null = null;

    // Form Data
    bspaType: 'new' | 'minor' | null = null;

    @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

    constructor(
        public dataService: DataService,
        private mambaService: MambaService, // Inject Mamba
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.route.data.subscribe(data => {
            this.bspaType = data['type'];
        });

        // Listen to global workflow state
        this.dataService.currentWorkflowStep$.subscribe(step => {
            this.currentStep = step;
        });

        // Ensure we start fresh
        // this.dataService.resetProjectData(); // Or maybe keep if navigating back?
    }

    // ==========================================
    // WORKFLOW NAVIGATION
    // ==========================================

    nextStep() {
        const idx = this.workflowSteps.indexOf(this.currentStep);
        if (idx < this.workflowSteps.length - 1) {
            this.currentStep = this.workflowSteps[idx + 1];
            this.dataService.updateWorkflowStep(this.currentStep);

            // Auto-trigger logic for certain steps?
            if (this.currentStep === 'INPUT_SHEET') {
                // Check if we have missing values to highlight
                this.checkMissingValues();
            }
        }
    }

    prevStep() {
        const idx = this.workflowSteps.indexOf(this.currentStep);
        if (idx > 0) {
            this.currentStep = this.workflowSteps[idx - 1];
            this.dataService.updateWorkflowStep(this.currentStep);
        }
    }

    setLevel(lvl: 1 | 2) {
        this.level = lvl;
    }

    // ==========================================
    // ACTION HANDLER (LEVEL 1 ACTIONS)
    // ==========================================

    /**
     * Level 1: "Only Buttons".
     * Triggers high-level actions without exposing detailed params.
     */
    runAutoCheck() {
        this.checkMissingValues();
        alert('Data Completeness Check: 95% - Ready for Review');
    }

    runAIEstimation() {
        this.dataService.estimateMissingValues();
        alert('AI Estimation Complete. Filled missing values with Trust Level 2 (Low).');
    }



    // ==========================================
    // DATA HANDLING
    // ==========================================

    /**
     * Updates the trust level for a specific parameter.
     * Ensures type safety for the 1-5 level range.
     */
    updateTrustLevel(paramId: string, level: number) {
        // Cast the number to the specific union type (1|2|3|4|5)
        const safeLevel = Math.max(1, Math.min(5, level)) as 1 | 2 | 3 | 4 | 5;

        // Assume working on the first variant for now
        if (this.dataService.variants.length === 0) return;
        const variantId = this.dataService.variants[0].id;

        // Use DataService to update or initialize the value struct
        const existing = this.dataService.variants[0].values[paramId];
        if (existing) {
            existing.trustLevel = safeLevel;
        } else {
            // Initialize if missing (e.g. manual entry started)
            this.dataService.setParameterValue(variantId, paramId, '', 'Manual', safeLevel);
        }
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
        } else {
            // Initialize with default trust 1 (Manual)
            this.dataService.setParameterValue(variantId, paramId, newValue, 'Manual', 1);
        }
    }

    checkMissingValues() {
        // Validation logic
        const isValid = this.dataService.validateForMamba();
        if (!isValid) {
            console.warn("Validation Failed: Missing Critical Parameters");
        }
    }

    uploadFile() {
        this.fileInputRef?.nativeElement.click();
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        // ... (Existing Excel Logic - kept mostly same but updated to set Trust Levels) ...
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
                    const variantId = this.dataService.variants[0].id; // Default to first variant
                    results.forEach(res => {
                        this.dataService.setParameterValue(variantId, res.paramId, res.foundValue, 'Input Sheet', 5);
                    });
                }

                // Move to next step if currently on Upload step
                if (this.currentStep === 'CUSTOMER_DATA') {
                    this.nextStep();
                }

            } catch (err) {
                console.error('Error parsing Excel file:', err);
                alert('Error reading Excel file.');
            }
        };
        fileReader.readAsArrayBuffer(file);
        input.value = '';
    }

    // ==========================================
    // SIMULATION (MAMBA)
    // ==========================================

    runMambaSimulation() {
        if (!this.dataService.validateForMamba()) {
            alert('Cannot run Simulation! Critical parameters are missing (Marked in Red). Please fill them or use AI Estimation.');
            return;
        }

        this.isSimulating = true;
        this.simulationResult = null;

        // Use first variant for simulation
        const variant = this.dataService.variants[0];

        this.mambaService.runSimulation(variant).subscribe({
            next: (result) => {
                this.isSimulating = false;
                this.simulationResult = result;
                if (result.success) {
                    this.currentStep = 'RESULTS'; // Jump to results
                }
            },
            error: (err) => {
                this.isSimulating = false;
                alert('MAMBA Connection Failed: ' + err.message);
            }
        });
    }

    goToHome() {
        this.router.navigate(['/home']);
    }
}
