import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../services/data.service';

@Component({
    selector: 'app-check-status',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './check-status.component.html',
})
export class CheckStatusComponent {
    showStatusError = false;

    constructor(
        public dataService: DataService,
        private router: Router
    ) { }

    confirmStatusCheck() {
        const { jiraTicketNumber, bspaNumber, epcNumber } = this.dataService.statusCheckData;

        if (!jiraTicketNumber.trim() || !bspaNumber.trim() || !epcNumber.trim()) {
            this.showStatusError = true;
            return;
        }

        this.showStatusError = false;
        this.router.navigate(['/sheet']);
    }

    goBackToHome() {
        this.router.navigate(['/home']);
    }
}
