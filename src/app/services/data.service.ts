// =======================================
// ✅ data.service.ts (FULL, LIKE YOUR VERSION)
// - keeps your structure 1:1
// - BUT: status sources only: Manual / Imported / Estimation
// - setParameterValue supports trustLevel (discrete origin label for filled params)
// - projectDescription included (because your UI shows it)
// =======================================

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// =========================
// TYPES & INTERFACES
// =========================

export interface ProjectDescriptionItem {
  key: string;
  value: string;
}

export type WorkflowStep =
  | 'CUSTOMER_DATA'
  | 'RB_DATA'
  | 'INPUT_SHEET'
  | 'P_TRIGGER'
  | 'DASHBOARD'
  | 'MAMBA'
  | 'RESULTS';

// ✅ ONLY these 3 sources (as you requested)
export type ValueSource = 'Manual' | 'Imported' | 'Estimation';

export type TrustLevel =
  | 'Not set'
  | 'Design value'
  | 'Estimation'
  | 'From customer'
  | 'Imported'
  | 'From EPC';

export interface ParameterValue {
  value: any;
  source: ValueSource;
  isMissing?: boolean; // Flag for missing simulation-critical values
  trustLevel?: TrustLevel; // origin label (shown when filled)
}

export interface CurvePoint {
  x: number;
  y: number;
  label?: string;
}

export interface CurveValue {
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  points: CurvePoint[];
}

/**
 * Represents a single product variant (e.g., Variant A, Variant B).
 */
export interface ProductVariant {
  id: string;
  name: string;
  values: { [paramId: string]: ParameterValue };
}

export type CheckStatus = 'check' | '';

export type MandatoryStatus = 'mandatory' | 'semi-mandatory' | 'optional' | 'irrelevant';

export interface DraftProject {
  id: string;
  name: string;
  epc: string;
  lastModified: Date;
  status: 'Draft' | 'Running' | 'Completed';
}

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
  mandatoryStatus: MandatoryStatus;
  defaultValue?: any;
  isSimulationRelevant?: boolean;
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
  providedIn: 'root',
})
export class DataService {
  // =========================
  // STATE: WORKFLOW
  // =========================
  private _currentWorkflowStep = new BehaviorSubject<WorkflowStep>('CUSTOMER_DATA');
  public currentWorkflowStep$ = this._currentWorkflowStep.asObservable();
  public pendingStartBspa = false;

  // =========================
  // STATE: ACTIVE PROJECT
  // =========================
  projectData: ProjectMetaData = {
    projectName: '',
    customer: '',
    internalNotes: '',
    epcNumber: '',
  };

  projectDescription: ProjectDescriptionItem[] = [];

  /** Available customers for dropdowns */
  customers: string[] = ['ESP', 'IPB'];

  // =========================
  // STATE: STATUS CHECK
  // =========================
  statusCheckData: BspaStatusCheckData = {
    jiraTicketNumber: '',
    bspaNumber: '',
    epcNumber: '',
  };

  // =========================
  // STATE: DRAFTS
  // =========================
  drafts: DraftProject[] = [
    { id: 'd1', name: 'Project Alpha', epc: 'EPC-123', lastModified: new Date(), status: 'Draft' },
    { id: 'd2', name: 'Brake System X', epc: 'EPC-456', lastModified: new Date(Date.now() - 86400000), status: 'Running' },
  ];

  // =========================
  // CONFIG: PARAMETER DEFINITIONS
  // =========================
  parameterGroups: ParameterGroup[] = [
    {
      groupName: '1. Vehicle Parameters',
      parameters: [
        { id: 'p1_1', name: 'Voltage Supply for Modulation', unit: '[[V]]', type: 'number', userComment: '', mandatoryStatus: 'mandatory', isSimulationRelevant: true },
        { id: 'p1_2', name: 'Voltage Supply for Actuation', unit: '[V]', type: 'number', userComment: '', mandatoryStatus: 'semi-mandatory', isSimulationRelevant: true, defaultValue: 12.0 },
        { id: 'p1_3', name: 'Power Supply redundancy Act / Mod', unit: '[-]', type: 'number', userComment: '', mandatoryStatus: 'optional' },
      ],
    },
    {
      groupName: '2. Mastercylinder',
      parameters: [
        { id: 'p2_1', name: 'TMC', unit: '', type: 'text', userComment: '', mandatoryStatus: 'mandatory' },
        { id: 'p2_2', name: 'MC1', unit: 'inch', type: 'number', userComment: '', mandatoryStatus: 'mandatory', isSimulationRelevant: true },
        { id: 'p2_3', name: 'MC2', unit: '', type: 'number', userComment: '', mandatoryStatus: 'optional' },
      ],
    },
    {
      groupName: '3. Brake pedal',
      parameters: [
        { id: 'p3_1', name: 'Pedal ratio', unit: '', type: 'text', userComment: '', mandatoryStatus: 'semi-mandatory', defaultValue: '3.5' },
        { id: 'p3_2', name: 'Pedal feel charac.', unit: 'curve', type: 'curve', userComment: '', mandatoryStatus: 'mandatory' },
      ],
    },
  ];

  // =========================
  // DATA: LOADED VARIANTS
  // =========================
  variants: ProductVariant[] = [{ id: 'v1', name: 'Variant A', values: {} }];

  constructor() {
    // Randomly assign mandatoryStatus for prototypical purposes
    const statuses: MandatoryStatus[] = ['mandatory', 'semi-mandatory', 'optional', 'irrelevant'];
    this.parameterGroups.forEach(group => {
      group.parameters.forEach(param => {
        // Simple random element from array
        const randomIndex = Math.floor(Math.random() * statuses.length);
        param.mandatoryStatus = statuses[randomIndex];
      });
    });
  }

  updateWorkflowStep(step: WorkflowStep) {
    this._currentWorkflowStep.next(step);
  }

  /**
   * Resets all ephemeral project data.
   * Call this when starting a new BSPA.
   */
  resetProjectData() {
    this.projectData = { projectName: '', customer: '', internalNotes: '', epcNumber: '' };
    this.projectDescription = [];
    this.statusCheckData = { jiraTicketNumber: '', bspaNumber: '', epcNumber: '' };
    this.variants.forEach((v) => (v.values = {}));
    this.updateWorkflowStep('CUSTOMER_DATA');
  }

  /**
   * Helper to set a parameter value with metadata
   * ✅ supports trustLevel (discrete origin label)
   */
  setParameterValue(
    variantId: string,
    paramId: string,
    value: any,
    source: ValueSource,
    trustLevel?: TrustLevel
  ) {
    const variant = this.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const isMissing = value === '' || value === null || value === undefined;

    variant.values[paramId] = {
      value,
      source,
      isMissing,
      trustLevel,
    };
  }

  /**
   * Simulate AI Estimation for missing values
   * ✅ uses source: Estimation
   */
  estimateMissingValues() {
    this.variants.forEach((variant) => {
      this.parameterGroups.forEach((group) => {
        group.parameters.forEach((param) => {
          const currentVal = variant.values[param.id];

          if (!currentVal || currentVal.value === '' || currentVal.value === undefined || currentVal.value === null) {
            let estimatedVal: any = null;

            if (param.type === 'number') estimatedVal = (Math.random() * 50 + 10).toFixed(2);
            if (param.type === 'text') estimatedVal = 'Estimated-Text';

            if (estimatedVal !== null) {
              variant.values[param.id] = {
                value: estimatedVal,
                source: 'Estimation',
                isMissing: false,
                trustLevel: 'Estimation',
              };
            }
          }
        });
      });
    });
  }

  /**
   * Validate for MAMBA Simulation
   * @returns string[] array of missing mandatory parameter names
   */
  validateForMamba(): string[] {
    const missingParams: Set<string> = new Set();

    this.variants.forEach((variant) => {
      this.parameterGroups.forEach((group) => {
        group.parameters.forEach((param) => {
          if (param.mandatoryStatus === 'mandatory') {
            const val = variant.values[param.id];
            if (!val || val.value === '' || val.value === undefined || val.value === null) {
              missingParams.add(param.name);

              if (!variant.values[param.id]) {
                variant.values[param.id] = { value: '', source: 'Manual', isMissing: true };
              } else {
                variant.values[param.id].isMissing = true;
              }
            }
          }
        });
      });
    });

    return Array.from(missingParams);
  }

  getMockEpcData(epc: string): { [paramId: string]: any } {
    if (!epc) return {};

    const mockData: { [paramId: string]: any } = {};

    let index = 0;
    this.parameterGroups.forEach(group => {
      group.parameters.forEach(param => {
        index++;

        // Simulate missing EPC data: Every 4th parameter is omitted from EPC
        if (index % 4 === 0) return;

        const currentVal = this.variants[0]?.values[param.id]?.value;

        // Simulate mismatch: Every 3rd parameter has a different value in EPC
        if (index % 3 === 0) {
          if (param.type === 'number' || (currentVal !== undefined && currentVal !== null && !isNaN(Number(currentVal)))) {
            mockData[param.id] = Number(currentVal || 10) + 12;
          } else {
            mockData[param.id] = 'Alternative ' + (currentVal || 'Val');
          }
        } else {
          // Simulate match: Give it the exact same value, or a fake default
          if (currentVal && String(currentVal).trim() !== '') {
            mockData[param.id] = currentVal;
          } else {
            mockData[param.id] = param.type === 'number' ? 12 : 'TMC-E';
          }
        }
      });
    });

    return mockData;
  }
}
