import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Interfaces 

interface ProductVariant {
  id: string;
  name: string;
  values: { [key: string]: any };
}

type CheckStatus = 'check' | '';

interface ParameterRow {
  id: string;
  name: string;          
  unit?: string;
  userComment?: string;
  checkStatus?: CheckStatus;   
  type: 'text' | 'number' | 'select' | 'curve';
  options?: string[];
}


interface ParameterGroup {
  groupName: string;
  parameters: ParameterRow[];
}

interface ProjectMetaData {
  projectName: string;
  customer: string;
  internalNotes: string;
  epcNumber: string; // EPC wird optional im Wizard gesetzt
}

/** ✅ NEW: Status Check Payload */
interface BspaStatusCheckData {
  jiraTicketNumber: string;
  bspaNumber: string;
  epcNumber: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class App implements OnInit {

  // =========================
  // VIEW & STEP STATE
  // =========================
  currentView: 'home' | 'sheet' = 'home';

  /**
   * ✅ UPDATED: Wizard steps erweitert
   * - type        => Cards (New/Minor/Status)
   * - epc         => EPC optional (nur New/Minor)
   * - statusCheck => 3 required Felder (Jira/BSPA/EPC)
   * - method      => Upload/Manual
   */
  currentStep: 'type' | 'epc' | 'statusCheck' | 'method' = 'type';

  /**
   * ✅ UPDATED: auch neuer "status" type
   */
  bspaType: 'new' | 'minor' | 'status' | null = null;

  // EPC ist optional → showEpcError nicht mehr nötig für EPC step
  showEpcError = false;

  // ✅ NEW: Errors für Status Check
  showStatusError = false;

  userRole: 'expert' | 'standard' = 'expert';

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

  // ✅ NEW: Status Check Data
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

  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  // ✅ NEW: File input trigger
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  ngOnInit() {}

  // =========================
  // WIZARD FLOW
  // =========================

  /**
   * ✅ NEW / MINOR:
   * EPC wird erst NACH Klick gezeigt (optional)
   */
  selectType(type: 'new' | 'minor') {
    this.bspaType = type;
    this.currentView = 'home';
    this.currentStep = 'epc';

    // EPC optional, also keine Fehlermeldung
    this.showEpcError = false;
  }

  /**
   * ✅ NEW: Check BSPA Status
   * -> eigener Step mit 3 required Inputs
   */
  selectStatusCheck() {
    this.bspaType = 'status';
    this.currentView = 'home';
    this.currentStep = 'statusCheck';
    this.showStatusError = false;

    // Optional: reset wenn man neu reingeht
    this.statusCheckData = { jiraTicketNumber: '', bspaNumber: '', epcNumber: '' };
  }

  /**
   * ✅ EPC Step: OPTIONAL
   * - kein required
   * - Continue geht immer zur Method Selection
   */
  confirmEpcOptional() {
    // kein required check!
    this.currentStep = 'method';
  }

  /**
   * ✅ Status Check Step: REQUIRED
   */
  confirmStatusCheck() {
    const { jiraTicketNumber, bspaNumber, epcNumber } = this.statusCheckData;

    if (!jiraTicketNumber.trim() || !bspaNumber.trim() || !epcNumber.trim()) {
      this.showStatusError = true;
      return;
    }

    this.showStatusError = false;

    // Danach ebenfalls Methode auswählen
    this.currentStep = 'method';
  }

  goToHome() {
    this.currentView = 'home';
    this.currentStep = 'type';
    this.bspaType = null;

    // Reset
    this.projectData.epcNumber = '';
    this.showEpcError = false;

    this.statusCheckData = { jiraTicketNumber: '', bspaNumber: '', epcNumber: '' };
    this.showStatusError = false;
  }

  // =========================
  // NAVIGATION TO SHEET
  // =========================
  goToSheet() {
    this.currentView = 'sheet';
  }

  // =========================
  // FILE UPLOAD (Explorer öffnen)
  // =========================

uploadFile() {
  this.fileInputRef?.nativeElement.click();
}


  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    console.log('File selected:', file);

    // später: parse XLSM
    this.currentView = 'sheet';

    // wichtig: gleiche Datei nochmal auswählbar
    input.value = '';
  }

  confirmEpc() {
  // EPC ist OPTIONAL → keine Pflichtprüfung
  this.showEpcError = false;
  this.currentStep = 'method';
}

}
