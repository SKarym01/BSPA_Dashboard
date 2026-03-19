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
    @Input() loginName = '';
    @Input() fullName = '';
    @Input() email = '';
    @Input() jobTitle = '';

    @Output() navigateHome = new EventEmitter<void>();
    @Output() roleChanged = new EventEmitter<UserRole>();
    isUserInfoOpen = false;

    goToHome() {
        this.navigateHome.emit();
    }

    toggleUserInfo(event?: Event) {
        event?.stopPropagation();
        this.isUserInfoOpen = !this.isUserInfoOpen;
    }

    closeUserInfo(event?: Event) {
        event?.stopPropagation();
        this.isUserInfoOpen = false;
    }

    onRoleChange(role: UserRole | null) {
        if (!role) return;
        this.roleChanged.emit(role);
    }
}
