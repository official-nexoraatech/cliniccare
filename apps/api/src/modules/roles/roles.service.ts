import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ALL_PERMISSION_KEYS } from '@clinic-care/shared-types';
import type { PermissionKey, RoleSummary } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { parsePermissions } from '../../common/utils/parse-permissions';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => this.toSummary(role));
  }

  async create(dto: CreateRoleDto): Promise<RoleSummary> {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    const role = await this.prisma.role.create({
      data: { name: dto.name, permissions: JSON.stringify(this.dedupe(dto.permissions)) },
      include: { _count: { select: { users: true } } },
    });
    return this.toSummary(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleSummary> {
    const role = await this.findOrThrow(id);

    if (role.isLocked) {
      throw new BadRequestException('This role is locked and cannot be edited');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
      if (existing) {
        throw new ConflictException('A role with this name already exists');
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.permissions ? { permissions: JSON.stringify(this.dedupe(dto.permissions)) } : {}),
      },
      include: { _count: { select: { users: true } } },
    });
    return this.toSummary(updated);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOrThrow(id);

    if (role.isLocked) {
      throw new BadRequestException('This role is locked and cannot be deleted');
    }

    const assignedUsers = await this.prisma.user.count({ where: { roleId: id } });
    if (assignedUsers > 0) {
      throw new BadRequestException(
        `Cannot delete this role — ${assignedUsers} user(s) are still assigned to it. Reassign them to another role first.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
  }

  private dedupe(keys: PermissionKey[]): PermissionKey[] {
    const allowed = new Set(ALL_PERMISSION_KEYS);
    return [...new Set(keys.filter((key) => allowed.has(key)))];
  }

  private async findOrThrow(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  private toSummary(role: {
    id: string;
    name: string;
    isLocked: boolean;
    permissions: string;
    _count: { users: number };
  }): RoleSummary {
    return {
      id: role.id,
      name: role.name,
      isLocked: role.isLocked,
      userCount: role._count.users,
      permissions: parsePermissions(role.permissions),
    };
  }
}
