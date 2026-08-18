import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@clinic-care/shared-types';
import { PERMISSIONS_KEY } from '../decorators/requires-permission.decorator';
import type { RequestUser } from './jwt-auth.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;

    if (!user || !required.every((key) => user.permissions.includes(key))) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
