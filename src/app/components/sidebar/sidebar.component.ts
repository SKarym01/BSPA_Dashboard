import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
    <aside class="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300">
      
      <!-- Navigation Menu -->
      <nav class="p-4 space-y-2 flex-1">
        
        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-3 mt-4">
            Main Functions
        </div>

        <a routerLink="/new" routerLinkActive="bg-blue-50 text-blue-600 border-blue-200"
           class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-transparent group">
            <div class="w-8 h-8 rounded-md bg-blue-100/50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-105 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <span class="font-medium">New BSPA</span>
        </a>

        <a routerLink="/minor" routerLinkActive="bg-cyan-50 text-cyan-600 border-cyan-200"
           class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-transparent group">
            <div class="w-8 h-8 rounded-md bg-cyan-100/50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-100 group-hover:scale-105 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <span class="font-medium">Running Change</span>
        </a>

        <a routerLink="/check" routerLinkActive="bg-emerald-50 text-emerald-600 border-emerald-200"
           class="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-transparent group">
           <div class="w-8 h-8 rounded-md bg-emerald-100/50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <span class="font-medium">Check Status</span>
        </a>

      </nav>

      <!-- Bottom / Footer -->
      <div class="p-4 border-t border-slate-200 bg-slate-50">
          <button (click)="goToHome()" class="flex items-center gap-3 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium w-full p-2 rounded hover:bg-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Dashboard Home
          </button>
      </div>

    </aside>
  `
})
export class SidebarComponent {
    constructor(private router: Router) { }

    goToHome() {
        this.router.navigate(['/home']);
    }
}
