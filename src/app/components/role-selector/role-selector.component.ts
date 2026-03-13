import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RoleOption, UserRole } from '../../services/role.service';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selector.component.html',
})
export class RoleSelectorComponent {
  @Input({ required: true }) roles: RoleOption[] = [];
  @Output() roleSelected = new EventEmitter<UserRole>();

  selectRole(role: UserRole): void {
    this.roleSelected.emit(role);
  }
}
