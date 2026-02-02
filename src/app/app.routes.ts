import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { NewBspaComponent } from './components/new-bspa/new-bspa.component';
import { CheckStatusComponent } from './components/check-status/check-status.component';
import { SheetComponent } from './components/sheet/sheet.component';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    // New -> Method Selection
    { path: 'new', component: NewBspaComponent, data: { type: 'new' } },
    // Minor -> Direct to Sheet
    { path: 'minor', component: SheetComponent, data: { mode: 'minor' } },
    { path: 'check', component: CheckStatusComponent },
    { path: 'sheet', component: SheetComponent },
];
