import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { RoleName } from '@clinic-care/shared-types';
import { PrismaService } from '../../modules/prisma/prisma.service';

export interface RequestUser {
  id: string;
  username: string;
  role: RoleName;
}

interface JwtPayload {
  id: string;
  username: string;
  role: RoleName;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Re-check the live account on every request, not just the token: a JWT can be
    // valid for hours after an admin deactivates the account or changes its role,
    // and stale claims would otherwise keep granting access/permissions until expiry.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Your account is no longer active. Please contact your administrator.');
    }

    request.user = {
      id: user.id,
      username: user.username,
      role: user.role.name as RoleName,
    } satisfies RequestUser;
    return true;
  }

  private extractToken(authHeader?: string): string | undefined {
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
