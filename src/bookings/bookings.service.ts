import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto, UpdateBookingStatusDto, RescheduleBookingDto, QueryBookingDto } from './dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(clientId: string, dto: CreateBookingDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: {
        provider: {
          include: {
            providerProfile: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    if (!service.isActive) {
      throw new BadRequestException('Este servicio no está disponible');
    }

    // Calculate total amount
    let subtotal = service.price;
    let packageData = null;

    if (dto.packageId) {
      packageData = await this.prisma.servicePackage.findUnique({
        where: { id: dto.packageId },
      });
      if (packageData) {
        subtotal = packageData.price;
      }
    }

    const total = subtotal;

    // Generate booking number
    const bookingNumber = `BK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const instantBooking = service.provider.providerProfile?.instantBooking ?? false;

    const booking = await this.prisma.booking.create({
      data: {
        bookingNumber,
        clientId,
        providerId: service.providerId,
        serviceId: service.id,
        packageId: dto.packageId,
        scheduledDate: new Date(dto.scheduledDate),
        scheduledStartTime: dto.scheduledStartTime,
        scheduledEndTime: dto.scheduledEndTime,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        latitude: dto.latitude,
        longitude: dto.longitude,
        addressNotes: dto.addressNotes,
        subtotal,
        total,
        clientNotes: dto.clientNotes,
        promotionCode: dto.promotionCode,
        status: instantBooking ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
      },
      include: {
        service: {
          select: { id: true, title: true, images: true },
        },
        provider: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    return booking;
  }

  async findClientBookings(clientId: string, query: QueryBookingDto) {
    const { page = 1, limit = 10, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = { clientId };

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.scheduledDate = {};
      if (fromDate) where.scheduledDate.gte = new Date(fromDate);
      if (toDate) where.scheduledDate.lte = new Date(toDate);
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
        include: {
          service: {
            select: { id: true, title: true, images: true },
          },
          provider: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findProviderBookings(userId: string, query: QueryBookingDto) {
    const { page = 1, limit = 10, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = { providerId: userId };

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.scheduledDate = {};
      if (fromDate) where.scheduledDate.gte = new Date(fromDate);
      if (toDate) where.scheduledDate.lte = new Date(toDate);
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
        include: {
          service: {
            select: { id: true, title: true, images: true },
          },
          client: {
            select: { id: true, firstName: true, lastName: true, avatar: true, phone: true },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        provider: {
          select: { id: true, firstName: true, lastName: true, avatar: true, phone: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true, avatar: true, phone: true },
        },
        package: true,
        payment: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    // Check authorization
    const isClient = booking.clientId === userId;
    const isProvider = booking.providerId === userId;

    if (!isClient && !isProvider) {
      throw new ForbiddenException('No tienes acceso a esta reserva');
    }

    return booking;
  }

  async updateStatus(bookingId: string, userId: string, dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    const isClient = booking.clientId === userId;
    const isProvider = booking.providerId === userId;

    if (!isClient && !isProvider) {
      throw new ForbiddenException('No tienes acceso a esta reserva');
    }

    // Validate status transitions
    this.validateStatusTransition(booking.status, dto.status, isClient, isProvider);

    const updateData: any = { status: dto.status };

    if (dto.status === BookingStatus.CANCELLED_BY_CLIENT || dto.status === BookingStatus.CANCELLED_BY_PROVIDER) {
      updateData.cancellationReason = dto.cancellationReason;
      updateData.cancelledBy = userId;
      updateData.cancelledAt = new Date();
    }

    if (dto.status === BookingStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }

    if (dto.status === BookingStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        service: {
          select: { id: true, title: true },
        },
        provider: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  private validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus,
    isClient: boolean,
    isProvider: boolean,
  ) {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED_BY_CLIENT, BookingStatus.CANCELLED_BY_PROVIDER],
      [BookingStatus.CONFIRMED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED_BY_CLIENT, BookingStatus.CANCELLED_BY_PROVIDER],
      [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED_BY_CLIENT, BookingStatus.CANCELLED_BY_PROVIDER],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED_BY_CLIENT]: [],
      [BookingStatus.CANCELLED_BY_PROVIDER]: [],
      [BookingStatus.NO_SHOW]: [],
      [BookingStatus.DISPUTED]: [],
      [BookingStatus.REFUNDED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(`No se puede cambiar el estado de ${currentStatus} a ${newStatus}`);
    }

    // Only provider can confirm or start
    if ((newStatus === BookingStatus.CONFIRMED || newStatus === BookingStatus.IN_PROGRESS) && !isProvider) {
      throw new ForbiddenException('Solo el proveedor puede realizar esta acción');
    }

    // Only provider can mark as completed
    if (newStatus === BookingStatus.COMPLETED && !isProvider) {
      throw new ForbiddenException('Solo el proveedor puede marcar como completado');
    }

    // Validate cancellation by correct party
    if (newStatus === BookingStatus.CANCELLED_BY_CLIENT && !isClient) {
      throw new ForbiddenException('Solo el cliente puede cancelar como cliente');
    }

    if (newStatus === BookingStatus.CANCELLED_BY_PROVIDER && !isProvider) {
      throw new ForbiddenException('Solo el proveedor puede cancelar como proveedor');
    }
  }

  async reschedule(bookingId: string, userId: string, dto: RescheduleBookingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    const isClient = booking.clientId === userId;
    const isProvider = booking.providerId === userId;

    if (!isClient && !isProvider) {
      throw new ForbiddenException('No tienes acceso a esta reserva');
    }

    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Solo se pueden reprogramar reservas pendientes o confirmadas');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        scheduledDate: new Date(dto.newDate),
        scheduledStartTime: dto.newTime,
        status: BookingStatus.PENDING,
      },
    });
  }

  async getUpcoming(userId: string, role: 'client' | 'provider', limit = 5) {
    const where: any = {
      scheduledDate: { gte: new Date() },
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    };

    if (role === 'client') {
      where.clientId = userId;
    } else {
      where.providerId = userId;
    }

    return this.prisma.booking.findMany({
      where,
      take: limit,
      orderBy: { scheduledDate: 'asc' },
      include: {
        service: {
          select: { id: true, title: true, images: true },
        },
        provider: {
          select: { firstName: true, lastName: true, avatar: true },
        },
        client: {
          select: { firstName: true, lastName: true, avatar: true },
        },
      },
    });
  }
}
