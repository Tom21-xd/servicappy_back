import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async toggleFavorite(userId: string, serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_serviceId: { userId, serviceId },
      },
    });

    if (existing) {
      await this.prisma.favorite.delete({
        where: { id: existing.id },
      });

      // Decrement favorite count
      await this.prisma.service.update({
        where: { id: serviceId },
        data: { favoriteCount: { decrement: 1 } },
      });

      return { isFavorite: false, message: 'Servicio eliminado de favoritos' };
    }

    await this.prisma.favorite.create({
      data: { userId, serviceId },
    });

    // Increment favorite count
    await this.prisma.service.update({
      where: { id: serviceId },
      data: { favoriteCount: { increment: 1 } },
    });

    return { isFavorite: true, message: 'Servicio agregado a favoritos' };
  }

  async getFavorites(userId: string, query: PaginationDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            include: {
              provider: {
                select: { firstName: true, lastName: true, avatar: true },
              },
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    return {
      data: favorites.map((f) => ({
        favoriteId: f.id,
        addedAt: f.createdAt,
        ...f.service,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkIsFavorite(userId: string, serviceId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: {
        userId_serviceId: { userId, serviceId },
      },
    });

    return { isFavorite: !!favorite };
  }

  async checkMultipleFavorites(userId: string, serviceIds: string[]) {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId,
        serviceId: { in: serviceIds },
      },
      select: { serviceId: true },
    });

    return {
      favorites: favorites.map((f) => f.serviceId),
    };
  }

  async removeFavorite(userId: string, favoriteId: string) {
    const favorite = await this.prisma.favorite.findFirst({
      where: { id: favoriteId, userId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorito no encontrado');
    }

    await this.prisma.favorite.delete({
      where: { id: favoriteId },
    });

    // Decrement favorite count
    await this.prisma.service.update({
      where: { id: favorite.serviceId },
      data: { favoriteCount: { decrement: 1 } },
    });

    return { message: 'Favorito eliminado' };
  }
}
