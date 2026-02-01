import { Injectable } from '@angular/core';

export interface ProductVariant {
  id: string;
  name: string;
  values: { [key: string]: any };
}

export type CheckStatus = 'check' | '';

export interface ParameterRow {
  id: string;
  name: string;
  unit?: string;
  userComment?: string;
  checkStatus?: CheckStatus;
  type: 'text' | 'number' | 'select' | 'curve';
  options?: string[];
}

export interface ParameterGroup {
  groupName: string;
  parameters: ParameterRow[];
}

export interface ProjectMetaData {
  projectName: string;
  customer: string;
  internalNotes: string;
  epcNumber: string;
}

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
  // DATA - PROJECT INFO
  // =========================
  projectData: ProjectMetaData = {
    projectName: '',
    customer: '',
    internalNotes: '',
    epcNumber: ''
  };

  customers: string[] = [
    'ESP',
    'IPB'
  ];

  statusCheckData: BspaStatusCheckData = {
    jiraTicketNumber: '',
    bspaNumber: '',
    epcNumber: ''
  };

  // =========================
  // DATA - PARAMETER GROUPS
  // =========================
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
  // DATA - VARIANTS
  // =========================
  variants: ProductVariant[] = [
    { id: 'v1', name: 'Variant A', values: {} },
    { id: 'v2', name: 'Variant B', values: {} }
  ];

  constructor() { }

  resetProjectData() {
    this.projectData = {
      projectName: '',
      customer: '',
      internalNotes: '',
      epcNumber: ''
    };
    this.statusCheckData = { jiraTicketNumber: '', bspaNumber: '', epcNumber: '' };
  }
}
