import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto, QueryServiceDto } from './dto';
import { ServiceStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryServiceDto) {
    const {
      categoryId,
      providerId,
      priceType,
      minPrice,
      maxPrice,
      city,
      state,
      search,
      status,
      isActive,
      isFeatured,
      sortBy,
    } = query;

    // Asegurar que page y limit sean números
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (providerId) where.providerId = providerId;
    if (priceType) where.priceType = priceType;
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    switch (sortBy) {
      case 'price':
        orderBy = { price: 'asc' };
        break;
      case 'rating':
        orderBy = { averageRating: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'popular':
        orderBy = { bookingCount: 'desc' };
        break;
    }

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            providerProfile: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        packages: true,
        faqs: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  async findBySlug(providerId: string, slug: string) {
    const service = await this.prisma.service.findUnique({
      where: {
        providerId_slug: {
          providerId,
          slug,
        },
      },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            providerProfile: true,
          },
        },
        category: true,
        packages: true,
        faqs: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  async findByProvider(providerId: string, query: QueryServiceDto) {
    const providerQuery = Object.assign(new QueryServiceDto(), query, { providerId });
    return this.findAll(providerQuery);
  }

  async create(providerId: string, dto: CreateServiceDto) {
    const slug = this.generateSlug(dto.title);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Categoría no encontrada');
    }

    const uniqueSlug = await this.ensureUniqueSlug(providerId, slug);

    const service = await this.prisma.service.create({
      data: {
        ...dto,
        slug: uniqueSlug,
        providerId,
        status: ServiceStatus.DRAFT,
        isActive: false,
      },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return service;
  }

  async update(id: string, providerId: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    if (service.providerId !== providerId) {
      throw new ForbiddenException('No tienes permiso para actualizar este servicio');
    }

    const updateData: any = { ...dto };

    if (dto.title && dto.title !== service.title) {
      updateData.slug = await this.ensureUniqueSlug(
        providerId,
        this.generateSlug(dto.title),
        id,
      );
    }

    return this.prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
      },
    });
  }

  async remove(id: string, providerId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    if (service.providerId !== providerId) {
      throw new ForbiddenException('No tienes permiso para eliminar este servicio');
    }

    await this.prisma.service.update({
      where: { id },
      data: {
        status: ServiceStatus.ARCHIVED,
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { message: 'Servicio archivado exitosamente' };
  }

  async incrementViewCount(id: string) {
    await this.prisma.service.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });
  }

  async toggleActive(id: string, providerId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    if (service.providerId !== providerId) {
      throw new ForbiddenException('No tienes permiso para modificar este servicio');
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        isActive: !service.isActive,
        status: !service.isActive ? ServiceStatus.ACTIVE : ServiceStatus.PAUSED,
      },
    });
  }

  async toggleFeatured(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        isFeatured: !service.isFeatured,
      },
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniqueSlug(
    providerId: string,
    slug: string,
    excludeId?: string,
  ): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.service.findUnique({
        where: {
          providerId_slug: {
            providerId,
            slug: uniqueSlug,
          },
        },
      });

      if (!existing || existing.id === excludeId) {
        break;
      }

      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }
}
