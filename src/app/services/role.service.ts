import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type UserRole = 'BSPA_COORDINATION' | 'TPM_CUSTOMER_TEAM';

export type RoleFeature =
  | 'access_new_workflow'
  | 'access_minor_workflow'
  | 'access_status_check'
  | 'access_validation'
  | 'upload_input_sheet'
  | 'manual_entry'
  | 'autofill_defaults'
  | 'ai_estimate'
  | 'edit_parameter_values'
  | 'edit_trust_level'
  | 'toggle_design_value_lock'
  | 'save_draft'
  | 'start_bspa'
  | 'export_results';

export interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
}

type PermissionMatrix = Record<UserRole, Record<RoleFeature, boolean>>;

const STORAGE_KEY = 'bspa.dashboard.selectedRole';

const ROLE_PERMISSIONS: PermissionMatrix = {
  BSPA_COORDINATION: {
    access_new_workflow: true,
    access_minor_workflow: true,
    access_status_check: true,
    access_validation: true,
    upload_input_sheet: true,
    manual_entry: true,
    autofill_defaults: true,
    ai_estimate: true,
    edit_parameter_values: true,
    edit_trust_level: true,
    toggle_design_value_lock: true,
    save_draft: true,
    start_bspa: true,
    export_results: true,
  },
  TPM_CUSTOMER_TEAM: {
    access_new_workflow: true,
    access_minor_workflow: false,
    access_status_check: true,
    access_validation: true,
    upload_input_sheet: true,
    manual_entry: true,
    autofill_defaults: true,
    ai_estimate: true,
    edit_parameter_values: true,
    edit_trust_level: true,
    toggle_design_value_lock: false,
    save_draft: true,
    start_bspa: true,
    export_results: true,
  },
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'BSPA_COORDINATION',
    label: 'BSPA Coordination',
    description: 'Coordination, monitoring and BSPA process execution',
  },
  {
    value: 'TPM_CUSTOMER_TEAM',
    label: 'TPM (Customer Team)',
    description: 'Customer-side data preparation and review',
  },
];

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  readonly roles: RoleOption[] = ROLE_OPTIONS;

  private readonly _selectedRole = new BehaviorSubject<UserRole | null>(this.loadRole());
  readonly selectedRole$ = this._selectedRole.asObservable();

  get selectedRole(): UserRole | null {
    return this._selectedRole.value;
  }

  get selectedRoleLabel(): string {
    const role = this.selectedRole;
    if (!role) return 'No role selected';
    const match = this.roles.find(r => r.value === role);
    return match?.label ?? role;
  }

  hasSelectedRole(): boolean {
    return this.selectedRole !== null;
  }

  selectRole(role: UserRole): void {
    this._selectedRole.next(role);
    localStorage.setItem(STORAGE_KEY, role);
  }

  can(feature: RoleFeature): boolean {
    const role = this.selectedRole;
    if (!role) return false;
    return ROLE_PERMISSIONS[role][feature];
  }

  private loadRole(): UserRole | null {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'BSPA_COORDINATION' || saved === 'TPM_CUSTOMER_TEAM') {
      return saved;
    }
    return null;
  }
}
