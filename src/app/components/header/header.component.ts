import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoleOption, UserRole } from '../../services/role.service';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './header.component.html',
})
export class HeaderComponent {
    @Input() roles: RoleOption[] = [];
    @Input() selectedRole: UserRole | null = null;

    @Output() navigateHome = new EventEmitter<void>();
    @Output() roleChanged = new EventEmitter<UserRole>();

    goToHome() {
        this.navigateHome.emit();
    }

    onRoleChange(role: UserRole | null) {
        if (!role) return;
        this.roleChanged.emit(role);
    }
}
