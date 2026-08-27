import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthUser, LoginResponse } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { parsePermissions } from '../../common/utils/parse-permissions';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';

interface UserRole {
  name: string;
  permissions: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: { role: true },
    });

    // Unknown username and wrong password both stay generic, on purpose — don't let a
    // login attempt reveal which usernames exist.
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Only reachable once the password is already proven correct, so this doesn't
    // give a username-probing attempt any way to learn an account's active status.
    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account has been deactivated. Contact your clinic administrator.',
      );
    }

    return this.issueToken(user.id, user.username, user.name, user.role, user.isActive);
  }

  async pinLogin(dto: PinLoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { role: true },
    });

    if (!user || !user.pin) {
      throw new UnauthorizedException('PIN login is not available for this user');
    }

    const pinMatches = await bcrypt.compare(dto.pin, user.pin);
    if (!pinMatches) {
      throw new UnauthorizedException('Incorrect PIN');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account has been deactivated. Contact your clinic administrator.',
      );
    }

    return this.issueToken(user.id, user.username, user.name, user.role, user.isActive);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { role: true },
    });

    return this.toAuthUser(user.id, user.username, user.name, user.role, user.isActive);
  }

  private async issueToken(
    id: string,
    username: string,
    name: string,
    role: UserRole,
    isActive: boolean,
  ): Promise<LoginResponse> {
    const authUser = this.toAuthUser(id, username, name, role, isActive);
    const accessToken = await this.jwtService.signAsync({
      id,
      username,
      role: role.name,
    });

    return { accessToken, user: authUser };
  }

  private toAuthUser(id: string, username: string, name: string, role: UserRole, isActive: boolean): AuthUser {
    return {
      id,
      username,
      name,
      role: role.name,
      isActive,
      permissions: parsePermissions(role.permissions),
    };
  }
}
