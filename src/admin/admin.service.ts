import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  QueryUsersDto,
  QueryServicesAdminDto,
  ModerateServiceDto,
  CreateBannerDto,
  UpdateBannerDto,
  SetConfigDto,
} from './dto';
import { UserRole, ServiceStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ==================== DASHBOARD ====================

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalProviders,
      totalServices,
      totalBookings,
      activeBookings,
      newUsersToday,
      newUsersMonth,
      pendingServices,
      pendingReports,
      openDisputes,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.PROVIDER } }),
      this.prisma.service.count({ where: { status: ServiceStatus.ACTIVE } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: { status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.service.count({ where: { status: ServiceStatus.PENDING_REVIEW } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);

    return {
      users: {
        total: totalUsers,
        providers: totalProviders,
        newToday: newUsersToday,
        newMonth: newUsersMonth,
      },
      services: {
        total: totalServices,
        pendingReview: pendingServices,
      },
      bookings: {
        total: totalBookings,
        active: activeBookings,
      },
      moderation: {
        pendingReports,
        openDisputes,
      },
    };
  }

  async getRecentActivity(limit = 20) {
    const [recentUsers, recentBookings, recentReports] = await Promise.all([
      this.prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.booking.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          total: true,
          createdAt: true,
          client: { select: { firstName: true, lastName: true } },
          service: { select: { title: true } },
        },
      }),
      this.prisma.report.findMany({
        take: limit,
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          targetType: true,
          reason: true,
          createdAt: true,
          author: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return { recentUsers, recentBookings, recentReports };
  }

  // ==================== USER MANAGEMENT ====================

  async findAllUsers(query: QueryUsersDto) {
    const { search, role, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (role) where.role = role;
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              bookingsAsClient: true,
              services: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        providerProfile: true,
        addresses: true,
        _count: {
          select: {
            bookingsAsClient: true,
            bookingsAsProvider: true,
            services: true,
            reviewsWritten: true,
            reviewsReceived: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateUserStatus(userId: string, adminId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Log the action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'user.status_update',
        entityType: 'user',
        entityId: userId,
        oldValues: { status: user.status },
        newValues: { status: dto.status, reason: dto.reason },
      },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
  }

  async updateUserRole(userId: string, adminId: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se está haciendo proveedor, crear perfil de proveedor si no existe
    if (dto.role === UserRole.PROVIDER) {
      const existingProfile = await this.prisma.providerProfile.findUnique({
        where: { userId },
      });

      if (!existingProfile) {
        await this.prisma.providerProfile.create({
          data: { userId },
        });
      }
    }

    // Log the action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'user.role_update',
        entityType: 'user',
        entityId: userId,
        oldValues: { role: user.role },
        newValues: { role: dto.role },
      },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  // ==================== SERVICE MODERATION ====================

  async findAllServicesAdmin(query: QueryServicesAdminDto) {
    const { search, status, categoryId, providerId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (providerId) where.providerId = providerId;

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      data: services,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async moderateService(serviceId: string, adminId: string, dto: ModerateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    // Log the action
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'service.moderate',
        entityType: 'service',
        entityId: serviceId,
        oldValues: { status: service.status },
        newValues: { status: dto.status, rejectionReason: dto.rejectionReason },
      },
    });

    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        status: dto.status,
        rejectionReason: dto.rejectionReason,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
      include: {
        provider: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  // ==================== BANNERS ====================

  async findAllBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createBanner(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        linkType: dto.linkType,
        linkRefId: dto.linkRefId,
        position: dto.position || 'home',
        sortOrder: dto.sortOrder || 0,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async updateBanner(bannerId: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id: bannerId } });

    if (!banner) {
      throw new NotFoundException('Banner no encontrado');
    }

    return this.prisma.banner.update({
      where: { id: bannerId },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async deleteBanner(bannerId: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id: bannerId } });

    if (!banner) {
      throw new NotFoundException('Banner no encontrado');
    }

    await this.prisma.banner.delete({ where: { id: bannerId } });

    return { message: 'Banner eliminado correctamente' };
  }

  // ==================== SYSTEM CONFIG ====================

  async getAllConfigs() {
    return this.prisma.systemConfig.findMany();
  }

  async getConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });

    if (!config) {
      throw new NotFoundException('Configuracion no encontrada');
    }

    return config;
  }

  async setConfig(dto: SetConfigDto) {
    return this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      update: { value: dto.value },
      create: { key: dto.key, value: dto.value },
    });
  }

  async deleteConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });

    if (!config) {
      throw new NotFoundException('Configuracion no encontrada');
    }

    await this.prisma.systemConfig.delete({ where: { key } });

    return { message: 'Configuracion eliminada' };
  }

  // ==================== ACTIVITY LOGS ====================

  async getActivityLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.activityLog.count(),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
