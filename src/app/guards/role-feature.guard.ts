import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoleFeature, RoleService } from '../services/role.service';

export const roleFeatureGuard: CanActivateFn = route => {
  const roleService = inject(RoleService);
  const router = inject(Router);
  const requiredFeature = route.data?.['requiredFeature'] as RoleFeature | undefined;

  if (!roleService.hasSelectedRole()) {
    return router.createUrlTree(['/home']);
  }

  if (requiredFeature && !roleService.can(requiredFeature)) {
    return router.createUrlTree(['/home']);
  }

  return true;
};
