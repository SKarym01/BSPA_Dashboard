import { Injectable } from '@angular/core';
export interface ProjectDescriptionItem {
  key: string;
  value: string;

}




/**
 * Represents a single product variant (e.g., Variant A, Variant B).
 */
export interface ProductVariant {
    id: string;
    name: string;
    values: { [key: string]: any }; // Stores parameter values keyed by parameter ID
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
    checkStatus?: string;

    type: 'text' | 'number' | 'select' | 'curve';
    options?: string[]; // For 'select' type
    defaultValue?: any; // Optional prefilled value from imports
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
    // STATE: ACTIVE PROJECT
    // =========================
    projectData: ProjectMetaData = {
        projectName: '',
        customer: '',
        internalNotes: '',
        epcNumber: ''
    };
      projectDescription: ProjectDescriptionItem[] = [];

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
                { id: 'p1_1', name: 'Voltage Supply for Modulation', unit: '[[V]]', type: 'number', userComment: '' },
                { id: 'p1_2', name: 'Voltage Supply for Actuation', unit: '[V]', type: 'number', userComment: '' },
                { id: 'p1_3', name: 'Power Supply redundancy Act / Mod', unit: '[-]', type: 'number', userComment: '' }
            ]
        },
        {
            groupName: '2. Mastercylinder',
            parameters: [
                { id: 'p2_1', name: 'TMC', unit: '', type: 'text', userComment: '' },
                { id: 'p2_2', name: 'MC1', unit: 'inch', type: 'number', userComment: '' },
                { id: 'p2_3', name: 'MC2', unit: '', type: 'number', userComment: '' }
            ]
        },
        {
            groupName: '3. Brake pedal',
            parameters: [
                { id: 'p3_1', name: 'Pedal ratio', unit: '°C', type: 'text', userComment: '' },
            ]
        }
    ];

    // =========================
    // DATA: LOADED VARIANTS
    // =========================
    // Holds the actual data values for each column/variant
    variants: ProductVariant[] = [
        { id: 'v1', name: 'Variant A', values: {} },
        { id: 'v2', name: 'Variant B', values: {} }
    ];

    constructor() { }

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
        // Optionally reset variant values here if needed
    }
}
