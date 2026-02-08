import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs'; // For reactive state management

// =========================
// TYPES & INTERFACES
// =========================

export type WorkflowStep = 'CUSTOMER_DATA' | 'RB_DATA' | 'INPUT_SHEET' | 'P_TRIGGER' | 'DASHBOARD' | 'MAMBA' | 'RESULTS';

export interface ParameterValue {
    value: any;
    trustLevel: 1 | 2 | 3 | 4 | 5; // 1 = Low Trust, 5 = High Trust (Enc/RB data)
    source: 'Manual' | 'Input Sheet' | 'Estimated' | 'Mamba';
    isMissing?: boolean; // Flag for missing simulation-critical values
}

/**
 * Represents a single product variant (e.g., Variant A, Variant B).
 */
export interface ProductVariant {
    id: string;
    name: string;
    // Updated: Values are now objects with metadata
    values: { [paramId: string]: ParameterValue };
}

export type CheckStatus = 'check' | '';

/**
 * Represents a single row in the parameter sheet.
 */
export interface ParameterRow {
    id: string;
    name: string;
    unit?: string;
    userComment?: string;
    checkStatus?: CheckStatus;
    type: 'text' | 'number' | 'select' | 'curve';
    options?: string[]; // For 'select' type
    isSimulationRelevant?: boolean; // Critical for MAMBA simulation (highlight red if missing)
    defaultValue?: any; // For MAMBA eval default
}

/**
 * Groups parameters together (e.g., "1. Vehicle Parameters").
 */
export interface ParameterGroup {
    groupName: string;
    parameters: ParameterRow[];
}

/**
 * Metadata for the current active project.
 */
export interface ProjectMetaData {
    projectName: string;
    customer: string;
    internalNotes: string;
    epcNumber: string;
}

/**
 * Data model for the "Check Status" feature.
 */
export interface BspaStatusCheckData {
    jiraTicketNumber: string;
    bspaNumber: string;
    epcNumber: string;
}

@Injectable({
    providedIn: 'root'
})
export class DataService {

    // =========================
    // STATE: WORKFLOW
    // =========================
    private _currentWorkflowStep = new BehaviorSubject<WorkflowStep>('CUSTOMER_DATA');
    public currentWorkflowStep$ = this._currentWorkflowStep.asObservable();

    // =========================
    // STATE: ACTIVE PROJECT
    // =========================
    projectData: ProjectMetaData = {
        projectName: '',
        customer: '',
        internalNotes: '',
        epcNumber: ''
    };

    /** Available customers for dropdowns */
    customers: string[] = [
        'ESP',
        'IPB'
    ];

    // =========================
    // STATE: STATUS CHECK
    // =========================
    statusCheckData: BspaStatusCheckData = {
        jiraTicketNumber: '',
        bspaNumber: '',
        epcNumber: ''
    };

    // =========================
    // CONFIG: PARAMETER DEFINITIONS
    // =========================
    // This defines the structure of the main sheet.
    // In a real app, this might come from an API or config file.
    parameterGroups: ParameterGroup[] = [
        {
            groupName: '1. Vehicle Parameters',
            parameters: [
                { id: 'p1_1', name: 'Voltage Supply for Modulation', unit: '[[V]]', type: 'number', userComment: '', isSimulationRelevant: true },
                { id: 'p1_2', name: 'Voltage Supply for Actuation', unit: '[V]', type: 'number', userComment: '', isSimulationRelevant: true },
                { id: 'p1_3', name: 'Power Supply redundancy Act / Mod', unit: '[-]', type: 'number', userComment: '' }
            ]
        },
        {
            groupName: '2. Mastercylinder',
            parameters: [
                { id: 'p2_1', name: 'TMC', unit: '', type: 'text', userComment: '' }, // Often manually filled
                { id: 'p2_2', name: 'MC1', unit: 'inch', type: 'number', userComment: '', isSimulationRelevant: true },
                { id: 'p2_3', name: 'MC2', unit: '', type: 'number', userComment: '' }
            ]
        },
        {
            groupName: '3. Brake pedal',
            parameters: [
                { id: 'p3_1', name: 'Pedal ratio', unit: '', type: 'text', userComment: '' },
            ]
        }
    ];

    // =========================
    // DATA: LOADED VARIANTS
    // =========================
    // Holds the actual data values for each column/variant
    variants: ProductVariant[] = [
        { id: 'v1', name: 'Variant A', values: {} },
        // { id: 'v2', name: 'Variant B', values: {} } // Start with 1 variant
    ];

    constructor() { }

    updateWorkflowStep(step: WorkflowStep) {
        this._currentWorkflowStep.next(step);
    }

    /**
     * Resets all ephemeral project data.
     * Call this when starting a new BSPA.
     */
    resetProjectData() {
        this.projectData = {
            projectName: '',
            customer: '',
            internalNotes: '',
            epcNumber: ''
        };
        this.statusCheckData = { jiraTicketNumber: '', bspaNumber: '', epcNumber: '' };
        this.variants.forEach(v => v.values = {});
        this.updateWorkflowStep('CUSTOMER_DATA');
    }

    /**
     * Helper to set a parameter value with metadata
     */
    /**
     * Helper to set a parameter value with metadata
     */
    setParameterValue(variantId: string, paramId: string, value: any, source: 'Manual' | 'Input Sheet' | 'Estimated', trustLevel: 1 | 2 | 3 | 4 | 5) {
        const variant = this.variants.find(v => v.id === variantId);
        if (variant) {
            const isMissing = value === '' || value === null || value === undefined;
            variant.values[paramId] = {
                value: value,
                source: source,
                trustLevel: trustLevel,
                isMissing: isMissing
            };
        }
    }

    /**
     * Simulate AI Estimation for missing values
     */
    estimateMissingValues() {
        this.variants.forEach(variant => {
            this.parameterGroups.forEach(group => {
                group.parameters.forEach(param => {
                    const currentVal = variant.values[param.id];

                    // Check if missing or empty
                    if (!currentVal || currentVal.value === '' || currentVal.value === undefined || currentVal.value === null) {

                        // "Estimation Logic": 
                        let estimatedVal: any = null;

                        // Mock estimation logic
                        if (param.type === 'number') estimatedVal = (Math.random() * 50 + 10).toFixed(2);
                        if (param.type === 'text') estimatedVal = 'Estimated-Text';

                        // Set val
                        if (estimatedVal !== null) {
                            variant.values[param.id] = {
                                value: estimatedVal,
                                source: 'Estimated',
                                trustLevel: 2, // Low trust for Estimated
                                isMissing: false
                            };
                        }
                    }
                });
            });
        });
    }

    /**
     * Validate for MAMBA Simulation
     * @returns boolean true if valid, false if blocked
     */
    validateForMamba(): boolean {
        let isValid = true;
        this.variants.forEach(variant => {
            this.parameterGroups.forEach(group => {
                group.parameters.forEach(param => {
                    // Check if critical
                    if (param.isSimulationRelevant) {
                        const val = variant.values[param.id];
                        if (!val || val.value === '' || val.value === undefined) {
                            isValid = false;
                            // Mark as missing in state if needed, or just return check
                            // Ideally, update the value object to reflect "missing" state for UI
                            if (!variant.values[param.id]) {
                                variant.values[param.id] = { value: '', source: 'Manual', trustLevel: 1, isMissing: true };
                            } else {
                                variant.values[param.id].isMissing = true;
                            }
                        }
                    }
                });
            });
        });
        return isValid;
    }
}
