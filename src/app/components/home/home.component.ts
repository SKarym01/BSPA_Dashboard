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

    // These can actually be removed too if not used by the template anymore, 
    // but I'll leave them if the user wants to add buttons back later or for existing tests.
    // For now, the template is static.
}
