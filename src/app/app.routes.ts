import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { NewBspaComponent } from './components/new-bspa/new-bspa.component';
import { CheckStatusComponent } from './components/check-status/check-status.component';
import { SheetComponent } from './components/sheet/sheet.component';
import { roleFeatureGuard } from './guards/role-feature.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    // New -> Method Selection
    { path: 'new', component: NewBspaComponent, canActivate: [roleFeatureGuard], data: { type: 'new', requiredFeature: 'access_new_workflow' } },
    // Minor -> Direct to Sheet
    { path: 'minor', component: SheetComponent, canActivate: [roleFeatureGuard], data: { mode: 'minor', requiredFeature: 'access_minor_workflow' } },
    { path: 'check', component: CheckStatusComponent, canActivate: [roleFeatureGuard], data: { requiredFeature: 'access_status_check' } },
    { path: 'sheet', component: SheetComponent, canActivate: [roleFeatureGuard], data: { requiredFeature: 'access_validation' } },
    { path: 'validation', component: SheetComponent, canActivate: [roleFeatureGuard], data: { requiredFeature: 'access_validation' } },
];
