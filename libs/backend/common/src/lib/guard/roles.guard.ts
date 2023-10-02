import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE } from '@cupo/backend/constant';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  matchRoles(roles: string[], userRoles: string[]): boolean {
    if (!userRoles?.length) {
      return roles.includes(ROLE.CUSTOMER);
    }

    return roles.some((role) => userRoles.includes(role));
  }

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!roles?.length || roles.includes(ROLE.NEUTRAL)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    return this.matchRoles(roles, request.user?.roles);
  }
}
