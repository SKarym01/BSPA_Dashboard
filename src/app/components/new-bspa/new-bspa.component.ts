import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { read, utils } from 'xlsx';

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
                // ROBUST "KEY-VALUE" FINDER (Heuristic)
                // ===================================
                // This function searches for keywords in the grid and tries to find a value 
                // to the right or below the keyword.
                const findValue = (keywords: string[]): string => {
                    for (let r = 0; r < rawData.length; r++) {
                        const row = rawData[r];
                        for (let c = 0; c < row.length; c++) {
                            const cellVal = String(row[c] || '').toLowerCase().trim();

                            if (keywords.some(k => cellVal.includes(k.toLowerCase()))) {
                                // Strategy 1: Look at the cell to the RIGHT (c + 1)
                                const valRight = row[c + 1];
                                if (valRight !== undefined && valRight !== null && String(valRight).trim() !== '') {
                                    return String(valRight).trim();
                                }
                                // Strategy 2: Look at the cell BELOW (r + 1)
                                if (rawData[r + 1] && rawData[r + 1][c]) {
                                    const valBelow = rawData[r + 1][c];
                                    if (valBelow !== undefined && valBelow !== null && String(valBelow).trim() !== '') {
                                        return String(valBelow).trim();
                                    }
                                }
                            }
                        }
                    }
                    return '';
                };

                // 1. Extract General Project Info
                const pName = findValue(['Project Name', 'Projekt Name', 'Project']);
                const epc = findValue(['EPC', 'EPC Number', 'EPC Nummer']);
                const cust = findValue(['Customer', 'Kunde']);

                if (pName) this.dataService.projectData.projectName = pName;
                if (epc) this.dataService.projectData.epcNumber = epc;
                if (cust) this.dataService.projectData.customer = cust;

                // 2. Extract Technical Parameters (Loop through defined groups)
                this.dataService.parameterGroups.forEach(group => {
                    group.parameters.forEach(param => {
                        // Search by fuzzy name or precise ID
                        const foundVal = findValue([param.name, param.id]);
                        if (foundVal) {
                            console.log(`Mapped Parameter: ${param.name} -> ${foundVal}`);
                            // Update the first variant with this value
                            if (this.dataService.variants.length > 0) {
                                this.dataService.variants[0].values[param.id] = foundVal;
                            }
                        }
                    });
                });

                console.log('Data Parsing Complete. Navigating to Sheet.');
                this.router.navigate(['/sheet']);

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
