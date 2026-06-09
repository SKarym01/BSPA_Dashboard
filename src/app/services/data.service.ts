// =======================================
// ✅ data.service.ts (FULL, LIKE YOUR VERSION)
// - keeps your structure 1:1
// - BUT: status sources only: Manual / Imported / Estimation
// - setParameterValue supports trustLevel (discrete origin label for filled params)
// - projectDescription included (because your UI shows it)
// =======================================

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  EvaluationDetail,
  ExtractedParameterViewDto,
  ValidationCurveDto,
  ValidationFindingDto,
  ValidationViewDto,
  ValidationVariantViewDto,
} from '../core/api/evaluations-api.service';

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
  currentEvaluation: EvaluationDetail | null = null;
  currentValidationView: ValidationViewDto | null = null;

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
    this.currentEvaluation = null;
    this.currentValidationView = null;
    this.statusCheckData = { jiraTicketNumber: '', bspaNumber: '', epcNumber: '' };
    this.variants.forEach((v) => (v.values = {}));
    this.updateWorkflowStep('CUSTOMER_DATA');
  }

  applyBackendValidation(evaluation: EvaluationDetail, validationView: ValidationViewDto | null): void {
    this.currentEvaluation = evaluation;
    this.currentValidationView = validationView;

    if (!validationView) {
      return;
    }

    this.projectDescription = Object.entries(validationView.project_info ?? {}).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }));

    const projectName = validationView.project_info?.['Project Name']
      ?? validationView.project_info?.['project_name']
      ?? this.projectData.projectName;
    const customer = validationView.project_info?.['Customer']
      ?? validationView.project_info?.['customer']
      ?? this.projectData.customer;

    this.projectData = {
      ...this.projectData,
      projectName: String(projectName ?? ''),
      customer: String(customer ?? ''),
      epcNumber: this.projectData.epcNumber,
    };

    const parameterMeta = new Map<string, {
      id: string;
      name: string;
      type: ParameterRow['type'];
      mandatoryStatus: MandatoryStatus;
      unit?: string;
      groupName: string;
      order: number;
    }>();
    const groupOrder = new Map<string, number>();

    let nextGroupOrder = 0;
    let nextParamOrder = 0;

    const registerGroup = (groupName: string): void => {
      if (!groupOrder.has(groupName)) {
        groupOrder.set(groupName, nextGroupOrder++);
      }
    };

    const registerParameter = (
      paramName: string,
      options?: {
        groupName?: string;
        type?: ParameterRow['type'];
        mandatoryStatus?: MandatoryStatus;
      }
    ): string => {
      const normalizedName = String(paramName ?? '').trim();
      const id = this.makeParameterId(normalizedName);
      const groupName = options?.groupName?.trim() || 'Extracted Parameters';
      registerGroup(groupName);

      const existing = parameterMeta.get(id);
      const nextStatus = this.mergeMandatoryStatus(
        existing?.mandatoryStatus ?? 'optional',
        options?.mandatoryStatus ?? 'optional'
      );

      if (existing) {
        existing.mandatoryStatus = nextStatus;
        if (this.isGenericBackendGroup(existing.groupName) && !this.isGenericBackendGroup(groupName)) {
          existing.groupName = groupName;
        }
        if (existing.type !== 'curve' && options?.type === 'curve') {
          existing.type = 'curve';
        }
        return id;
      }

      parameterMeta.set(id, {
        id,
        name: normalizedName,
        type: options?.type ?? 'text',
        mandatoryStatus: nextStatus,
        groupName,
        order: nextParamOrder++,
      });
      return id;
    };

    for (const variant of validationView.variants ?? []) {
      for (const group of variant.parameter_groups ?? []) {
        registerGroup(group.name || 'Backend Parameters');
      }

      for (const parameter of variant.extracted_parameters ?? []) {
        const parameterName = this.getExtractedParameterName(parameter);
        if (!parameterName) continue;
        const extractedGroupName = this.getExtractedParameterGroupName(parameter);

        registerParameter(parameterName, {
          type: this.inferParameterType(parameter.value),
          groupName: extractedGroupName
            || this.findGroupNameForParameter(variant, parameterName, 'Backend Parameters'),
          mandatoryStatus: this.findMandatoryStatusForParameter(variant, parameterName),
        });
      }

      for (const curve of variant.curves ?? []) {
        registerParameter(curve.name, {
          type: 'curve',
          groupName: this.findGroupNameForParameter(variant, curve.name, 'Backend Parameters'),
          mandatoryStatus: this.findMandatoryStatusForParameter(variant, curve.name),
        });
      }
    }

    const groups = new Map<string, ParameterRow[]>();
    for (const meta of [...parameterMeta.values()].sort((a, b) => a.order - b.order)) {
      const rows = groups.get(meta.groupName) ?? [];
      rows.push({
        id: meta.id,
        name: meta.name,
        type: meta.type,
        unit: meta.unit ?? '',
        mandatoryStatus: meta.mandatoryStatus,
        userComment: '',
      });
      groups.set(meta.groupName, rows);
    }

    this.parameterGroups = [...groups.entries()]
      .sort((a, b) => (groupOrder.get(a[0]) ?? 0) - (groupOrder.get(b[0]) ?? 0))
      .map(([groupName, parameters]) => ({ groupName, parameters }));

    this.variants = (validationView.variants ?? []).map((variant, variantIndex) => {
      const values: ProductVariant['values'] = {};

      for (const parameter of variant.extracted_parameters ?? []) {
        const parameterName = this.getExtractedParameterName(parameter);
        if (!parameterName) continue;
        const extractedGroupName = this.getExtractedParameterGroupName(parameter);

        const paramId = registerParameter(parameterName, {
          type: this.inferParameterType(parameter.value),
          groupName: extractedGroupName
            || this.findGroupNameForParameter(variant, parameterName, 'Backend Parameters'),
          mandatoryStatus: this.findMandatoryStatusForParameter(variant, parameterName),
        });
        values[paramId] = {
          value: parameter.value,
          source: parameter.source === 'default_applied' ? 'Estimation' : 'Imported',
          isMissing: this.isEmptyValue(parameter.value),
          trustLevel: parameter.source === 'default_applied' ? 'Estimation' : 'Imported',
        };
      }

      for (const curve of variant.curves ?? []) {
        const paramId = registerParameter(curve.name, {
          type: 'curve',
          groupName: this.findGroupNameForParameter(variant, curve.name, 'Backend Parameters'),
          mandatoryStatus: this.findMandatoryStatusForParameter(variant, curve.name),
        });
        values[paramId] = {
          value: this.mapCurveDto(curve),
          source: 'Imported',
          isMissing: !curve.points?.length && !curve.series?.length,
          trustLevel: 'Imported',
        };
      }

      for (const finding of variant.findings ?? []) {
        if (!finding.parameter_name) continue;
        const findingName = this.normalizeParameterName(finding.parameter_name);
        const mappedCode = this.mapFindingCodeToMandatoryStatus(finding.code);

        for (const [paramId, value] of Object.entries(values)) {
          const currentName = this.normalizeParameterName(parameterMeta.get(paramId)?.name);
          if (currentName !== findingName) continue;

          if (mappedCode === 'mandatory') {
            // Findings status is authoritative for validation state.
            value.isMissing = true;
          }
        }
      }

      return {
        id: `v${variantIndex + 1}`,
        name: variant.variant_name || `Variant ${variantIndex + 1}`,
        values,
      };
    });
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

  estimateValueForField(variantId: string, paramId: string): boolean {
    const variant = this.variants.find(v => v.id === variantId);
    if (!variant) return false;

    const param = this.parameterGroups
      .flatMap(group => group.parameters)
      .find(p => p.id === paramId);
    if (!param || param.type === 'curve' || param.type === 'select') return false;

    const currentVal = variant.values[paramId];
    const isMissing = !currentVal || currentVal.value === '' || currentVal.value === undefined || currentVal.value === null;
    if (!isMissing) return false;

    const estimatedVal = this.buildEstimatedValue(param);
    if (estimatedVal === null) return false;

    variant.values[paramId] = {
      value: estimatedVal,
      source: 'Estimation',
      isMissing: false,
      trustLevel: 'Estimation',
    };
    return true;
  }

  /**
   * Simulate AI Estimation for missing values
   * ✅ uses source: Estimation
   */
  estimateMissingValues() {
    this.variants.forEach((variant) => {
      this.parameterGroups.forEach((group) => {
        group.parameters.forEach((param) => {
          this.estimateValueForField(variant.id, param.id);
        });
      });
    });
  }

  private buildEstimatedValue(param: ParameterRow): any {
    if (param.type === 'number') return (Math.random() * 50 + 10).toFixed(2);
    if (param.type === 'text') return 'Estimated-Text';
    return null;
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

  private makeParameterId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      || `param_${Math.random().toString(36).slice(2, 8)}`;
  }

  private inferParameterType(value: unknown): ParameterRow['type'] {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') {
      const normalized = value.trim().replace(',', '.');
      if (normalized && !Number.isNaN(Number(normalized))) return 'number';
    }
    return 'text';
  }

  private isEmptyValue(value: unknown): boolean {
    return value === '' || value === null || value === undefined;
  }

  private mergeMandatoryStatus(
    current: MandatoryStatus,
    next: MandatoryStatus
  ): MandatoryStatus {
    const rank: Record<MandatoryStatus, number> = {
      mandatory: 3,
      'semi-mandatory': 2,
      optional: 1,
      irrelevant: 0,
    };
    return rank[next] > rank[current] ? next : current;
  }

  private mapFindingCodeToMandatoryStatus(code: string | undefined): MandatoryStatus {
    switch (code) {
      case 'MISSING_REQUIRED':
        return 'mandatory';
      case 'MISSING_ASSUMED':
      case 'DEFAULT_APPLIED':
        return 'semi-mandatory';
      default:
        return 'optional';
    }
  }

  private findGroupNameForParameter(
    variant: ValidationVariantViewDto,
    parameterName: string,
    fallback = 'Backend Parameters'
  ): string {
    const parameterKey = this.normalizeParameterName(parameterName);

    const matchedExtractedParameter = (variant.extracted_parameters ?? [])
      .find(parameter => this.normalizeParameterName(this.getExtractedParameterName(parameter)) === parameterKey);

    const extractedGroupName = matchedExtractedParameter
      ? this.getExtractedParameterGroupName(matchedExtractedParameter)
      : '';

    if (extractedGroupName && String(extractedGroupName).trim()) {
      return String(extractedGroupName).trim();
    }

    return fallback;
  }

  private normalizeParameterName(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private findMandatoryStatusForParameter(
    variant: ValidationVariantViewDto,
    parameterName: string
  ): MandatoryStatus {
    const parameterKey = this.normalizeParameterName(parameterName);
    const statuses = (variant.findings ?? [])
      .filter(finding => this.normalizeParameterName(finding.parameter_name) === parameterKey)
      .map(finding => this.mapFindingCodeToMandatoryStatus(finding.code));

    return statuses.reduce<MandatoryStatus>(
      (current, next) => this.mergeMandatoryStatus(current, next),
      'optional'
    );
  }

  private getExtractedParameterName(parameter: ExtractedParameterViewDto): string {
    return String(parameter?.name ?? '').trim();
  }

  private getExtractedParameterGroupName(parameter: ExtractedParameterViewDto): string {
    const raw = parameter as unknown as {
      group_name?: unknown;
      groupName?: unknown;
      group?: unknown;
    };
    return String(raw?.group_name ?? raw?.groupName ?? raw?.group ?? '').trim();
  }

  private isGenericBackendGroup(groupName: string | undefined): boolean {
    const normalized = String(groupName ?? '').trim().toLowerCase();
    return normalized === 'backend parameters' || normalized === 'extracted parameters';
  }

  private mapCurveDto(curve: ValidationCurveDto): CurveValue {
    const defaultXLabel = curve.series?.[0]?.label || 'X';
    const defaultYLabel = curve.series?.[1]?.label || curve.name;

    if (curve.points?.length) {
      return {
        xLabel: defaultXLabel,
        yLabel: defaultYLabel,
        points: curve.points.map(point => ({
          x: point.x,
          y: point.y,
        })),
      };
    }

    const xSeries = curve.series?.[0]?.values ?? [];
    const ySeries = curve.series?.[1]?.values ?? [];
    return {
      xLabel: defaultXLabel,
      yLabel: defaultYLabel,
      points: xSeries.map((x, index) => ({
        x,
        y: ySeries[index] ?? 0,
      })),
    };
  }
}
