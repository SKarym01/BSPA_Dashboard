import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './home.component.html',
})
export class HomeComponent {

    constructor(private router: Router) { }

    selectType(type: 'new' | 'minor') {
        if (type === 'new') {
            this.router.navigate(['/new']);
        } else {
            this.router.navigate(['/minor']);
        }
    }

    selectStatusCheck() {
        this.router.navigate(['/check']);
    }
}
