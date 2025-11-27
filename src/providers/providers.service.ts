import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderProfileDto, UpdateProviderProfileDto, SetAvailabilityDto, SpecialDateDto, PortfolioDto, QueryProviderDto } from './dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateProviderProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { providerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.providerProfile) {
      throw new BadRequestException('Ya tienes un perfil de proveedor');
    }

    const [profile] = await this.prisma.$transaction([
      this.prisma.providerProfile.create({
        data: {
          userId,
          businessName: dto.businessName,
          headline: dto.headline,
          description: dto.description,
          yearsOfExperience: dto.yearsOfExperience,
          serviceRadius: dto.serviceRadius,
          travelFee: dto.travelFee,
          minimumBookingHours: dto.minimumBookingHours,
          cancellationPolicy: dto.cancellationPolicy,
          instantBooking: dto.instantBooking ?? false,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.PROVIDER },
      }),
    ]);

    return profile;
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            createdAt: true,
          },
        },
        availability: true,
        specialDates: {
          where: {
            date: { gte: new Date() },
          },
          orderBy: { date: 'asc' },
          take: 30,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    // Get services separately since they reference User not ProviderProfile
    const services = await this.prisma.service.findMany({
      where: { providerId: userId, isActive: true },
      take: 10,
    });

    return { ...profile, services };
  }

  async updateProfile(userId: string, dto: UpdateProviderProfileDto) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    const updateData: any = { ...dto };

    return this.prisma.providerProfile.update({
      where: { userId },
      data: updateData,
    });
  }

  async setAvailability(userId: string, dto: SetAvailabilityDto) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    // Delete existing availability and create new
    await this.prisma.providerAvailability.deleteMany({
      where: { providerProfileId: profile.id },
    });

    const availability = await this.prisma.providerAvailability.createMany({
      data: dto.availability.map((slot) => ({
        providerProfileId: profile.id,
        dayOfWeek: slot.dayOfWeek,
        isAvailable: slot.isAvailable,
        startTime: slot.startTime || '09:00',
        endTime: slot.endTime || '18:00',
        breakStart: slot.breakStart,
        breakEnd: slot.breakEnd,
      })),
    });

    return { message: 'Disponibilidad actualizada', count: availability.count };
  }

  async getAvailability(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { availability: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    return profile.availability;
  }

  async addSpecialDate(userId: string, dto: SpecialDateDto) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    return this.prisma.providerSpecialDate.create({
      data: {
        providerProfileId: profile.id,
        date: new Date(dto.date),
        isAvailable: dto.isAvailable,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });
  }

  async removeSpecialDate(userId: string, dateId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    const specialDate = await this.prisma.providerSpecialDate.findFirst({
      where: { id: dateId, providerProfileId: profile.id },
    });

    if (!specialDate) {
      throw new NotFoundException('Fecha especial no encontrada');
    }

    await this.prisma.providerSpecialDate.delete({
      where: { id: dateId },
    });

    return { message: 'Fecha especial eliminada' };
  }

  async updatePortfolio(userId: string, dto: PortfolioDto) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    return this.prisma.providerProfile.update({
      where: { userId },
      data: {
        portfolioImages: dto.images,
        portfolioVideos: dto.videos || [],
      },
    });
  }

  async searchProviders(query: QueryProviderDto) {
    const { page = 1, limit = 10, city, state, minRating, hasInstantBooking, sortBy } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (city) {
      where.user = { city };
    }

    if (state) {
      where.user = { ...where.user, state };
    }

    if (minRating) {
      where.averageRating = { gte: minRating };
    }

    if (hasInstantBooking !== undefined) {
      where.instantBooking = hasInstantBooking;
    }

    let orderBy: any = { averageRating: 'desc' };
    if (sortBy === 'reviews') {
      orderBy = { totalReviews: 'desc' };
    } else if (sortBy === 'responseTime') {
      orderBy = { averageResponseTime: 'asc' };
    }

    const [providers, total] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.providerProfile.count({ where }),
    ]);

    return {
      data: providers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPublicProfile(providerId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            createdAt: true,
          },
        },
        availability: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Get services
    const services = await this.prisma.service.findMany({
      where: { providerId: profile.userId, isActive: true },
    });

    return { ...profile, services };
  }

  async getProviderStats(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de proveedor no encontrado');
    }

    const [totalBookings, completedBookings, pendingBookings, totalEarnings, recentReviews] = await Promise.all([
      this.prisma.booking.count({ where: { providerId: userId } }),
      this.prisma.booking.count({ where: { providerId: userId, status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { providerId: userId, status: { in: ['PENDING', 'CONFIRMED'] } } }),
      this.prisma.booking.aggregate({
        where: { providerId: userId, status: 'COMPLETED' },
        _sum: { total: true },
      }),
      this.prisma.review.findMany({
        where: { targetId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          author: {
            select: { firstName: true, lastName: true, avatar: true },
          },
        },
      }),
    ]);

    return {
      totalBookings,
      completedBookings,
      pendingBookings,
      completionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
      totalEarnings: totalEarnings._sum.total || 0,
      averageRating: profile.averageRating,
      totalReviews: profile.totalReviews,
      recentReviews,
    };
  }
}
