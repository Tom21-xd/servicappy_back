import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, ProviderResponseDto, QueryReviewDto } from './dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        review: true,
        service: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (booking.clientId !== authorId) {
      throw new ForbiddenException('No puedes reseñar esta reserva');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Solo puedes reseñar reservas completadas');
    }

    if (booking.review) {
      throw new BadRequestException('Ya has reseñado esta reserva');
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        authorId,
        targetId: booking.providerId,
        serviceId: booking.serviceId,
        overallRating: dto.overallRating,
        qualityRating: dto.qualityRating,
        punctualityRating: dto.punctualityRating,
        communicationRating: dto.communicationRating,
        valueRating: dto.valueRating,
        comment: dto.comment,
        images: dto.images || [],
      },
      include: {
        author: {
          select: { firstName: true, lastName: true, avatar: true },
        },
        service: {
          select: { id: true, title: true },
        },
      },
    });

    // Update provider profile stats
    await this.updateProviderStats(booking.providerId);

    // Update service stats
    await this.updateServiceStats(booking.serviceId);

    return review;
  }

  private async updateProviderStats(providerId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { targetId: providerId },
      _avg: { overallRating: true },
      _count: true,
    });

    await this.prisma.providerProfile.updateMany({
      where: { userId: providerId },
      data: {
        averageRating: stats._avg.overallRating || 0,
        totalReviews: stats._count,
      },
    });
  }

  private async updateServiceStats(serviceId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { serviceId },
      _avg: { overallRating: true },
      _count: true,
    });

    await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        averageRating: stats._avg.overallRating || 0,
        reviewCount: stats._count,
      },
    });
  }

  async findProviderReviews(providerId: string, query: QueryReviewDto) {
    const { page = 1, limit = 10, minRating, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    const where: any = { targetId: providerId };

    if (minRating) {
      where.overallRating = { gte: minRating };
    }

    let orderBy: any = { createdAt: 'desc' };
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'highest':
        orderBy = { overallRating: 'desc' };
        break;
      case 'lowest':
        orderBy = { overallRating: 'asc' };
        break;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: { firstName: true, lastName: true, avatar: true },
          },
          service: {
            select: { id: true, title: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    // Get rating distribution
    const ratingDistribution = await this.prisma.review.groupBy({
      by: ['overallRating'],
      where: { targetId: providerId },
      _count: true,
    });

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    ratingDistribution.forEach((r) => {
      distribution[r.overallRating as keyof typeof distribution] = r._count;
    });

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        distribution,
        total,
      },
    };
  }

  async findServiceReviews(serviceId: string, query: QueryReviewDto) {
    const { page = 1, limit = 10, minRating, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    const where: any = { serviceId };

    if (minRating) {
      where.overallRating = { gte: minRating };
    }

    let orderBy: any = { createdAt: 'desc' };
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'highest':
        orderBy = { overallRating: 'desc' };
        break;
      case 'lowest':
        orderBy = { overallRating: 'asc' };
        break;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: { firstName: true, lastName: true, avatar: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addProviderResponse(reviewId: string, userId: string, dto: ProviderResponseDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    if (review.targetId !== userId) {
      throw new ForbiddenException('No puedes responder a esta reseña');
    }

    if (review.response) {
      throw new BadRequestException('Ya has respondido a esta reseña');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        response: dto.response,
        respondedAt: new Date(),
      },
    });
  }

  async findOne(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        author: {
          select: { firstName: true, lastName: true, avatar: true },
        },
        target: {
          select: { firstName: true, lastName: true },
        },
        service: {
          select: { id: true, title: true },
        },
        booking: {
          select: { scheduledDate: true },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    return review;
  }

  async getClientReviews(authorId: string, query: QueryReviewDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { authorId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            select: { id: true, title: true },
          },
          target: {
            select: { firstName: true, lastName: true, avatar: true },
          },
        },
      }),
      this.prisma.review.count({ where: { authorId } }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
