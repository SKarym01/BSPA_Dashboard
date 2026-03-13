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
    this.roleService.selectRole(role);
    this.dataService.resetProjectData();
    this.router.navigate(['/home']);
  }
}
