import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { UserSummary } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.toSummary(user));
  }

  async create(dto: CreateUserDto): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
    if (!role) {
      throw new BadRequestException(`Role "${dto.role}" does not exist`);
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        mobile: dto.mobile || null,
        passwordHash: await bcrypt.hash(dto.password, 10),
        pin: dto.pin ? await bcrypt.hash(dto.pin, 10) : null,
        roleId: role.id,
      },
      include: { role: true },
    });

    return this.toSummary(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserSummary> {
    const user = await this.findOrThrow(id);

    if (dto.role && dto.role !== user.role.name) {
      await this.assertNotLastActiveAdmin(user, 'change the role of');
      const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
      if (!role) {
        throw new BadRequestException(`Role "${dto.role}" does not exist`);
      }
      await this.prisma.user.update({ where: { id }, data: { roleId: role.id } });
    }

    if (dto.name || dto.mobile) {
      await this.prisma.user.update({
        where: { id },
        data: { ...(dto.name ? { name: dto.name } : {}), ...(dto.mobile ? { mobile: dto.mobile } : {}) },
      });
    }

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
    return this.toSummary(updated);
  }

  async deactivate(id: string): Promise<UserSummary> {
    const user = await this.findOrThrow(id);
    await this.assertNotLastActiveAdmin(user, 'deactivate');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: { role: true },
    });
    return this.toSummary(updated);
  }

  async reactivate(id: string): Promise<UserSummary> {
    await this.findOrThrow(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: { role: true },
    });
    return this.toSummary(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
    });
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** The clinic must always keep at least one active ADMIN, or it locks itself out of user management. */
  private async assertNotLastActiveAdmin(
    user: { id: string; isActive: boolean; role: { name: string } },
    action: string,
  ) {
    if (user.role.name !== 'ADMIN' || !user.isActive) return;

    const activeAdminCount = await this.prisma.user.count({
      where: { isActive: true, role: { name: 'ADMIN' } },
    });

    if (activeAdminCount <= 1) {
      throw new BadRequestException(
        `Cannot ${action} the only active admin account. Create another admin first.`,
      );
    }
  }

  private toSummary(user: {
    id: string;
    name: string;
    username: string;
    mobile: string | null;
    isActive: boolean;
    pin: string | null;
    role: { name: string };
  }): UserSummary {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      mobile: user.mobile,
      role: user.role.name as UserSummary['role'],
      isActive: user.isActive,
      hasPin: Boolean(user.pin),
    };
  }
}
