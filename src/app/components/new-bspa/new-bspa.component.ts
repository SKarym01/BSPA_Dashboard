import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../services/data.service';

@Component({
    selector: 'app-new-bspa',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './new-bspa.component.html',
})
export class NewBspaComponent implements OnInit {
    // Always start with 'method' (Upload/Manual) as per requirements
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
        this.route.data.subscribe(data => {
            this.bspaType = data['type'];
        });
    }

    confirmEpc() {
        this.showEpcError = false;
        this.currentStep = 'method';
    }

    uploadFile() {
        this.fileInputRef?.nativeElement.click();
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        console.log('File selected:', file);

        // Simulate parsing
        this.router.navigate(['/sheet']);
        input.value = '';
    }

    goToSheet() {
        this.router.navigate(['/sheet']);
    }

    goBackToHome() {
        this.router.navigate(['/home']);
    }
}
