// =======================================
// ✅ new-bspa.component.ts (FIXED)
// =======================================
import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
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
  templateUrl: './new-bspa.component.html'
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
    private router: Router,
    private zone: NgZone // ✅ FIX: injected properly
  ) {}

  ngOnInit(): void {
    this.dataService.currentWorkflowStep$.subscribe(step => {
      this.currentStep = step;
      if (step === 'INPUT_SHEET' && this.epcNumber) {
        this.loadEpcData();
      }
    });

    if (this.dataService.variants.length === 0) {
      this.dataService.variants = [{ id: 'v1', name: 'Variant A', values: {} }];
    }

    this.epcNumber = this.dataService.projectData.epcNumber || '';
    if (this.epcNumber && this.currentStep === 'INPUT_SHEET') {
      this.loadEpcData();
    }

    if (this.dataService.pendingStartBspa) {
      this.dataService.pendingStartBspa = false;
      setTimeout(() => this.startBspa(), 0);
    }
  }

  setStep(step: WorkflowStep) {
    if (this.epcNumber) this.dataService.projectData.epcNumber = this.epcNumber;
    this.dataService.updateWorkflowStep(step);
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

  isEpcMismatch(paramId: string): boolean {
    if (!this.epcNumber || this.epcValues[paramId] === undefined) return false;
    const currentVal = this.dataService.variants[0].values[paramId]?.value;
    const epcVal = this.epcValues[paramId];
    return String(currentVal ?? '').trim() !== String(epcVal ?? '').trim();
  }

  goToHome() {
    this.router.navigate(['/']);
  }

  nextStep() {
    if (this.currentStep === 'CUSTOMER_DATA') {
      this.setStep('INPUT_SHEET');
      this.router.navigate(['/validation']);
    }
  }

  isMissing(paramId: string): boolean {
    if (this.dataService.variants.length === 0) return true;
    const val = this.dataService.variants[0].values[paramId];
    return !val || val.value === '' || val.value === undefined || val.value === null;
  }

  updateParamValue(paramId: string, newValue: any) {
    if (this.dataService.variants.length === 0) return;

    const variantId = this.dataService.variants[0].id;
    const existing = this.dataService.variants[0].values[paramId];

    if (existing) {
      existing.value = newValue;
      existing.isMissing = newValue === '' || newValue === null || newValue === undefined;
      if (!existing.isMissing) existing.source = 'Manual';
    } else {
      this.dataService.setParameterValue(variantId, paramId, newValue, 'Manual');
    }
  }

 autofillDefaults() {
  const v = this.dataService.variants[0];
  if (!v) return;

  this.dataService.parameterGroups.forEach(group => {
    group.parameters.forEach(param => {
      if (this.isMissing(param.id) && param.defaultValue !== undefined) {
        // Defaults zählen bei dir als Estimation (weil nur 3 Status erlaubt)
        this.dataService.setParameterValue(v.id, param.id, param.defaultValue, 'Estimation', 4);
      }
    });
  });
}


  runAiEstimation() {
    this.dataService.estimateMissingValues();
  }

  saveAsDraft() {
    const newDraft: any = {
      id: 'd-' + Date.now(),
      name: this.epcNumber ? `EPC: ${this.epcNumber}` : 'Untitled Project',
      epc: this.epcNumber || 'N/A',
      lastModified: new Date(),
      status: 'Draft'
    };

    this.dataService.drafts.unshift(newDraft);
    this.dataService.resetProjectData();
    this.router.navigate(['/']);
  }

  startBspa() {
    const missingMandatory = this.dataService.parameterGroups.some(group =>
      group.parameters.some(p => p.mandatoryStatus === 'mandatory' && this.isMissing(p.id))
    );

    if (missingMandatory) {
      alert('Please fill in all MANDATORY (Red) fields before starting BSPA.');
      return;
    }

    this.dataService.projectData.epcNumber = this.epcNumber;

    this.setStep('MAMBA');
    this.isSimulating = true;

    this.mambaService.runSimulation(this.dataService.variants[0]).subscribe(result => {
      this.isSimulating = false;
      this.simulationResult = result;
      setTimeout(() => this.setStep('RESULTS'), 1000);
    });
  }

  uploadFile() {
    this.fileInputRef?.nativeElement.click();
  }

 onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];

  const validExtensions = ['.xlsm', '.xlsx', '.xls', '.xlsb'];
  const fileName = file.name.toLowerCase();
  const isValid = validExtensions.some(ext => fileName.endsWith(ext));
  if (!isValid) {
    alert('Invalid file format. Please upload an Excel file (.xlsx, .xlsm, .xls, .xlsb).');
    input.value = '';
    return;
  }

  const fileReader = new FileReader();

  fileReader.onload = e => {
    this.zone.run(() => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;

        const workbook = read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        const extractor = new ExcelExtractor(rawData);

        // --- Project Description ---
        const anyExtractor = extractor as any;
        if (typeof anyExtractor.extractProjectDescription === 'function') {
          this.dataService.projectDescription = anyExtractor.extractProjectDescription();
        } else {
          this.dataService.projectDescription = [];
        }

        // --- Project metadata scan ---
        const findValue = (keywords: string[]): string => {
          for (let r = 0; r < Math.min(rawData.length, 20); r++) {
            const row = rawData[r] || [];
            for (let c = 0; c < row.length; c++) {
              const cellVal = String(row[c] || '').toLowerCase().trim();
              if (keywords.some(k => cellVal.includes(k.toLowerCase()))) {
                return String(row[c + 1] || rawData[r + 1]?.[c] || '').trim();
              }
            }
          }
          return '';
        };

        const pName = findValue(['project name', 'projekt name', 'project']);
        const epc = findValue(['epc', 'epc number', 'epc nummer']);
        const cust = findValue(['customer', 'kunde']);

        if (pName) this.dataService.projectData.projectName = pName;
        if (epc) this.dataService.projectData.epcNumber = epc;
        if (cust) this.dataService.projectData.customer = cust;

        // Ensure at least one variant exists
        if (this.dataService.variants.length === 0) {
          this.dataService.variants = [{ id: 'v1', name: 'Variant 1', values: {} }];
        }

        // --- Matrix parse if available ---
        const parsed = (extractor as any).parseMatrixFromSheet?.() ?? null;

        if (parsed && parsed.parameterGroups?.length > 0 && parsed.variants?.length > 0) {
          this.dataService.parameterGroups = parsed.parameterGroups;

          this.dataService.variants = parsed.variants.map((v: { id: string; name: string; values: Record<string, any> }) => ({
            id: v.id,
            name: v.name,
            values: Object.fromEntries(
              Object.entries(v.values).map(([paramId, val]) => [
                paramId,
                { value: val, source: 'Imported', trustLevel: 5 }
              ])
            )
          }));
        } else {
          // fallback: discover groups then map values
          const discovered = (extractor as any).discoverParameterGroups?.() ?? [];
          if (discovered.length > 0) {
            this.dataService.parameterGroups = discovered;
          }

          const variantId = this.dataService.variants[0].id;
          const results = extractor.extractAllParameters(this.dataService.parameterGroups);

          results.forEach(res => {
            this.dataService.setParameterValue(variantId, res.paramId, res.foundValue, 'Imported', 5);
          });
        }

        // ✅ AFTER UPLOAD: go directly to VALIDATION
        this.epcNumber = this.dataService.projectData.epcNumber || this.epcNumber;
        if (this.epcNumber) this.loadEpcData();

        this.dataService.updateWorkflowStep('INPUT_SHEET');
        this.currentStep = 'INPUT_SHEET';

        // Validation UI is on /validation route
        this.router.navigate(['/validation']);

      } catch (err) {
        console.error('Error parsing Excel file:', err);
        alert('Error reading Excel file.');
      }
    });
  };

  fileReader.readAsArrayBuffer(file);
  input.value = '';
}

getPV(variantId: string, paramId: string): ParameterValue | undefined {
  const v = this.dataService.variants.find(x => x.id === variantId);
  return v?.values?.[paramId];
}

getSource(variantId: string, paramId: string): 'Manual' | 'Imported' | 'Estimation' | '' {
  return this.getPV(variantId, paramId)?.source ?? '';
}

setManual(variantId: string, paramId: string, value: any) {
  this.dataService.setParameterValue(variantId, paramId, value, 'Manual');
}

statusDotClass(paramId: string): string {
  const param = this.dataService.parameterGroups.flatMap(g => g.parameters).find(p => p.id === paramId);
  if (!param) return 'bg-slate-300';

  // Missing based on first variant (or adapt per-variant)
  const missing = this.isMissing(paramId);

  if (param.mandatoryStatus === 'mandatory') return missing ? 'bg-red-500' : 'bg-red-400';
  if (param.mandatoryStatus === 'semi-mandatory') return missing ? 'bg-orange-500' : 'bg-orange-400';
  return missing ? 'bg-blue-500' : 'bg-blue-400';
}

valueBorderClass(paramId: string): string {
  const param = this.dataService.parameterGroups.flatMap(g => g.parameters).find(p => p.id === paramId);
  if (!param) return 'border-slate-200';

  const missing = this.isMissing(paramId);

  if (param.mandatoryStatus === 'mandatory') return missing ? 'border-red-500' : 'border-slate-200';
  if (param.mandatoryStatus === 'semi-mandatory') return missing ? 'border-orange-500' : 'border-slate-200';
  return missing ? 'border-blue-500' : 'border-slate-200';
}

sourceTextClass(src: string): string {
  // ✅ only 3 sources
  if (src === 'Imported') return 'text-black font-bold';
  if (src === 'Estimation') return 'text-blue-600 italic';
  return 'text-slate-500';
}


}
