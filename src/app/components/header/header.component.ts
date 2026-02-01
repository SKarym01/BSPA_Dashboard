import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './header.component.html',
})
export class HeaderComponent {
    @Output() navigateHome = new EventEmitter<void>();

    goToHome() {
        this.navigateHome.emit();
    }
}
