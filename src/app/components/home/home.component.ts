import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DataService } from '../../services/data.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './home.component.html',
})
export class HomeComponent {

    constructor(
        private router: Router,
        public dataService: DataService // Inject DataService
    ) { }

    get activeProjectsCount(): number {
        return this.dataService.drafts.filter(d => d.status === 'Draft' || d.status === 'Running').length;
    }

    get completedProjectsCount(): number {
        return this.dataService.drafts.filter(d => d.status === 'Completed').length;
    }
}
