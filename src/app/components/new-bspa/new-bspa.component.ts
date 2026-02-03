import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { read, utils } from 'xlsx';
import { ExcelExtractor } from '../../utils/excel-extractor';

/**
 * Component for setting up a new BSPA project.
 * Handles:
 * 1. Method selection (Upload vs Manual)
 * 2. Excel Parsing via 'xlsx'
 * 3. Navigation to the main Sheet
 */
@Component({
    selector: 'app-new-bspa',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './new-bspa.component.html',
})
export class NewBspaComponent implements OnInit {
    currentStep: 'method' | 'epc' = 'method';
    bspaType: 'new' | 'minor' | null = null;
    showEpcError = false;

    @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

    constructor(
        public dataService: DataService,
        private route: ActivatedRoute,
        private router: Router,
        private zone: NgZone
    ) { }

    ngOnInit(): void {
        // Determine if we are doing a "New" or "Minor" BSPA from the route data
        this.route.data.subscribe(data => {
            this.bspaType = data['type'];
        });
    }

    confirmEpc() {
        this.showEpcError = false;
        this.currentStep = 'method';
    }

    /**
     * Triggers the hidden file input click.
     */
    uploadFile() {
        this.fileInputRef?.nativeElement.click();
    }
    
    /**
     * Main Handler for Excel Uploads.
     * Reads .xlsx/.xlsm files, parses them, and maps data to DataService.
     */
    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];

        // VALIDATION: Check for Common Excel Extensions
        const validExtensions = ['.xlsm', '.xlsx', '.xls', '.xlsb'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            alert('Invalid file format. Please upload an Excel file (.xlsx, .xlsm, .xls).');
            input.value = '';
            return;
        }

        console.log('Reading file:', file.name);

        const fileReader = new FileReader();
        fileReader.onload = (e) => {
            // FileReader callbacks can run outside Angular's zone; ensure UI updates render.
            this.zone.run(() => {
                try {
                    const arrayBuffer = e.target?.result;
                    // Parse the workbook
                    const workbook = read(arrayBuffer);

                // Grab the first sheet
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Convert Sheet to JSON (Header: 1 gives us a 2D array of raw values)
                const rawData = utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                console.log('Raw Sheet Data parsed.');

                // ===================================
                // USE ROBUST EXCEL EXTRACTOR
                // ===================================
                const extractor = new ExcelExtractor(rawData);

// ✅ HIER ist richtig:
this.dataService.projectDescription = extractor.extractProjectDescription();

// danach normal weiter:
                // 1. Parse matrix structure (variants as columns, parameters as rows)
                console.log('Parsing matrix structure from Excel...');
                const parsed = extractor.parseMatrixFromSheet();

                // 2. EXTRACT VALUES & METADATA
                const findValue = (keywords: string[]): string => {
                    for (let r = 0; r < Math.min(rawData.length, 20); r++) {
                        const row = rawData[r];
                        for (let c = 0; c < row.length; c++) {
                            const cellVal = String(row[c] || '').toLowerCase().trim();
                            if (keywords.some(k => cellVal.includes(k.toLowerCase()))) {
                                return String(row[c + 1] || rawData[r + 1]?.[c] || '').trim();
                            }
                        }
                    }
                    return '';
                };

                const pName = findValue(['Project Name', 'Projekt Name', 'Project']);
                const epc = findValue(['EPC', 'EPC Number', 'EPC Nummer']);
                const cust = findValue(['Customer', 'Kunde']);

                if (pName) this.dataService.projectData.projectName = pName;
                if (epc) this.dataService.projectData.epcNumber = epc;
                if (cust) this.dataService.projectData.customer = cust;

                // 3. Apply matrix data to UI (if found)
                if (parsed && parsed.parameterGroups.length > 0 && parsed.variants.length > 0) {
                    this.dataService.parameterGroups = parsed.parameterGroups;
                    this.dataService.variants = parsed.variants;
                } else {
                    console.warn('Matrix not found or empty. Falling back to default parsing.');
                    const discoveredGroups = extractor.discoverParameterGroups();
                    if (discoveredGroups.length > 0) {
                        this.dataService.parameterGroups = discoveredGroups;
                    }
                    const results = extractor.extractAllParametersWithColumns(this.dataService.parameterGroups);
                    if (results.length > 0) {
                        const colSet = new Set<number>();
                        results.forEach(r => r.values.forEach(v => colSet.add(v.col)));
                        const cols = Array.from(colSet).sort((a, b) => a - b);
                        if (cols.length > 0) {
                            this.dataService.variants = cols.map((col, idx) => ({
                                id: `v${idx + 1}`,
                                name: extractor.getColumnHeader(col, results[0].labelRow) || `Variant ${idx + 1}`,
                                values: {}
                            }));
                            results.forEach(res => {
                                res.values.forEach(v => {
                                    const variantIndex = cols.indexOf(v.col);
                                    if (variantIndex >= 0) {
                                        this.dataService.variants[variantIndex].values[res.paramId] = v.value;
                                    }
                                });
                            });
                        }
                    }
                }

                    console.log('Data Parsing Complete. Navigating to Sheet.');
                    this.router.navigate(['/sheet']);

                } catch (err) {
                    console.error('Error parsing Excel file:', err);
                    alert('Error reading Excel file. Please ensure it is a valid format.');
                }
            });
        };

        fileReader.readAsArrayBuffer(file);
        input.value = '';
    }
    
    goToSheet() {
        this.router.navigate(['/sheet']);
    }

    goBackToHome() {
        this.router.navigate(['/home']);
    }
}
