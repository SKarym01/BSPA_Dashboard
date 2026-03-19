import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DataService } from './services/data.service';
import { RoleSelectorComponent } from './components/role-selector/role-selector.component';
import { RoleService, UserRole } from './services/role.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, SidebarComponent, RoleSelectorComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class App {
  readonly userInfo = {
    loginName: 'kas9abt',
    fullName: 'Shaam Karym',
    email: 'shaam.karym@bosch.com',
    jobTitle: 'Lead Engineer',
  };

  constructor(
    private router: Router,
    private dataService: DataService,
    public roleService: RoleService
  ) { }

  onNavigateHome() {
    this.dataService.resetProjectData();
    this.router.navigate(['/home']);
  }

  onRoleSelected(role: UserRole) {
    const hadRole = this.roleService.hasSelectedRole();
    this.roleService.selectRole(role);
    // Preserve all in-memory project/sheet state while switching roles.
    // Only first-time role selection routes to home.
    if (!hadRole) {
      this.router.navigate(['/home']);
    }
  }
}
