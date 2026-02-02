import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
        private router: Router
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

                // 1. EXTRACT STRUCTURE FIRST (Dynamic Discovery)
                console.log('Discovering parameter structure from Excel...');
                const discoveredGroups = extractor.discoverParameterGroups();

                if (discoveredGroups.length > 0) {
                    console.log(`Discovered ${discoveredGroups.length} groups.`);
                    // Update DataService with REAL structure from Excel
                    this.dataService.parameterGroups = discoveredGroups;
                } else {
                    console.warn('No structure discovered. Falling back to default.');
                }

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

                // 3. Extract Technical Parameters (Now using the NEW discovered structure)
                const results = extractor.extractAllParameters(this.dataService.parameterGroups);
                console.log(`Extracted ${results.length} parameters.`);

                if (this.dataService.variants.length > 0) {
                    const variant = this.dataService.variants[0];
                    // Clear previous values just in case
                    variant.values = {};
                    results.forEach(res => {
                        variant.values[res.paramId] = res.foundValue;
                    });
                }

                console.log('Data Parsing Complete. Navigating to Sheet.');

            } catch (err) {
                console.error('Error parsing Excel file:', err);
                alert('Error reading Excel file. Please ensure it is a valid format.');
            }
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
