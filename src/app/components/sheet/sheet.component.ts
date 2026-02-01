import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';

@Component({
    selector: 'app-sheet',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sheet.component.html',
})
export class SheetComponent {
    userRole: 'expert' | 'standard' = 'expert';

    constructor(public dataService: DataService) { }
}
