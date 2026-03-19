import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { FormsModule } from '@angular/forms';
import { RoleFeature, RoleService, UserRole } from '../../services/role.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    template: `
    <aside class="relative z-[1200] w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300">
      
      <!-- Navigation Menu -->
      <nav class="p-4 flex-1 flex flex-col min-h-0">
        
        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-3 mt-4">
            Main Functions
        </div>

        <div class="space-y-2">
        <a *ngIf="can('access_new_workflow')" (click)="forceNew()" routerLink="/new" routerLinkActive="bg-blue-50 text-blue-600 border-blue-200"
           class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-transparent group cursor-pointer">
            <div class="w-8 h-8 rounded-md bg-blue-100/50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-105 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <span class="font-medium">New BSPA</span>
        </a>

        <a *ngIf="can('access_minor_workflow')" routerLink="/minor" routerLinkActive="bg-cyan-50 text-cyan-600 border-cyan-200"
           class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-transparent group">
            <div class="w-8 h-8 rounded-md bg-cyan-100/50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-100 group-hover:scale-105 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <span class="font-medium">Running Change</span>
        </a>

        <a *ngIf="can('access_status_check')" routerLink="/check" routerLinkActive="bg-emerald-50 text-emerald-600 border-emerald-200"
           class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-transparent group">
           <div class="w-8 h-8 rounded-md bg-emerald-100/50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <span class="font-medium">Check Status</span>
        </a>
        </div>

        <div class="mt-auto pt-4 border-t border-slate-200">
          <button
            type="button"
            (click)="toggleUserInfo($event)"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors border border-transparent text-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span class="text-sm font-semibold">User Information</span>
          </button>
        </div>
      </nav>

      <div *ngIf="isUserInfoOpen" class="fixed inset-0 bg-slate-900/20 z-[20000]"
        (click)="closeUserInfo($event)"></div>
      <div *ngIf="isUserInfoOpen"
        class="fixed inset-0 z-[20001] flex items-center justify-center p-4"
        (click)="$event.stopPropagation()">
        <div class="w-full max-w-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
          (click)="$event.stopPropagation()">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">User Information</div>
            <button type="button" class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              (click)="closeUserInfo($event)" aria-label="Close user info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
            </button>
          </div>
          <div class="grid grid-cols-[106px_1fr] gap-x-2 gap-y-1.5 text-xs">
            <div class="font-semibold text-slate-500">Username</div>
            <div class="font-medium text-slate-700 break-all">{{ loginName || '-' }}</div>
            <div class="font-semibold text-slate-500">Display Name</div>
            <div class="font-medium text-slate-700 break-words">{{ fullName || '-' }}</div>
            <div class="font-semibold text-slate-500">Email</div>
            <div class="font-medium text-slate-700 break-all">{{ email || '-' }}</div>
            <div class="font-semibold text-slate-500">Request Role</div>
            <div>
              <select
                [ngModel]="roleService.selectedRole"
                (ngModelChange)="onRoleChange($event)"
                class="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option [ngValue]="null" disabled>Select role</option>
                <option *ngFor="let role of roleService.roles" [ngValue]="role.value">{{ role.label }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

    </aside>
  `
})
export class SidebarComponent {
    @Input() loginName = '';
    @Input() fullName = '';
    @Input() email = '';
    isUserInfoOpen = false;

    constructor(
        private router: Router,
        private dataService: DataService,
        public roleService: RoleService
    ) { }

    can(feature: RoleFeature): boolean {
        return this.roleService.can(feature);
    }

    goToHome() {
        this.router.navigate(['/home']);
    }

    forceNew() {
        if (!this.can('access_new_workflow')) return;
        this.dataService.resetProjectData();
    }

    onRoleChange(role: UserRole | null): void {
        if (!role) return;
        this.roleService.selectRole(role);
    }

    toggleUserInfo(event?: Event): void {
        event?.stopPropagation();
        this.isUserInfoOpen = !this.isUserInfoOpen;
    }

    closeUserInfo(event?: Event): void {
        event?.stopPropagation();
        this.isUserInfoOpen = false;
    }
}
