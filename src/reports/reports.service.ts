import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReportDto,
  ResolveReportDto,
  CreateDisputeDto,
  ResolveDisputeDto,
  AddEvidenceDto,
  QueryReportsDto,
  QueryDisputesDto,
} from './dto';
import { ReportStatus, DisputeStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ==================== REPORTS ====================

  async createReport(userId: string, dto: CreateReportDto) {
    // Verificar que el usuario no se reporte a sí mismo si es un reporte de usuario
    if (dto.targetType === 'user' && dto.targetRefId === userId) {
      throw new BadRequestException('No puedes reportarte a ti mismo');
    }

    // Verificar si el objeto reportado existe según el tipo
    await this.validateReportTarget(dto.targetType, dto.targetRefId);

    const report = await this.prisma.report.create({
      data: {
        authorId: userId,
        targetId: dto.targetId,
        targetType: dto.targetType,
        targetRefId: dto.targetRefId,
        reason: dto.reason,
        description: dto.description,
        evidence: dto.evidence || [],
        status: ReportStatus.PENDING,
      },
    });

    return report;
  }

  async findMyReports(userId: string, query: QueryReportsDto) {
    const { page = 1, limit = 10, status, reason, targetType } = query;
    const skip = (page - 1) * limit;

    const where: any = { authorId: userId };

    if (status) {
      where.status = status;
    }

    if (reason) {
      where.reason = reason;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findReportById(reportId: string, userId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    // Solo el autor del reporte puede verlo (los admins tienen acceso desde otra ruta)
    if (report.authorId !== userId) {
      throw new ForbiddenException('No tienes acceso a este reporte');
    }

    return report;
  }

  async findAllReports(query: QueryReportsDto) {
    const { page = 1, limit = 10, status, reason, targetType } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (reason) {
      where.reason = reason;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveReport(reportId: string, adminId: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.DISMISSED) {
      throw new BadRequestException('Este reporte ya fue resuelto');
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        resolvedAt: new Date(),
        resolvedBy: adminId,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedReport;
  }

  // ==================== DISPUTES ====================

  async createDispute(userId: string, dto: CreateDisputeDto) {
    // Verificar que el booking existe
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        dispute: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada');
    }

    // Verificar que el usuario es parte del booking
    if (booking.clientId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta reserva');
    }

    // Verificar que no existe ya una disputa
    if (booking.dispute) {
      throw new BadRequestException('Ya existe una disputa para esta reserva');
    }

    // Crear la disputa
    const dispute = await this.prisma.dispute.create({
      data: {
        bookingId: booking.id,
        clientId: booking.clientId,
        providerId: booking.providerId,
        reason: dto.reason,
        description: dto.description,
        evidence: dto.evidence || [],
        status: DisputeStatus.OPEN,
      },
      include: {
        booking: {
          include: {
            service: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return dispute;
  }

  async findDisputeByBooking(bookingId: string, userId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            service: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Disputa no encontrada');
    }

    // Verificar que el usuario es parte de la disputa
    if (dispute.clientId !== userId && dispute.providerId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta disputa');
    }

    return dispute;
  }

  async addEvidence(disputeId: string, userId: string, dto: AddEvidenceDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Disputa no encontrada');
    }

    // Verificar que el usuario es parte de la disputa
    if (dispute.clientId !== userId && dispute.providerId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta disputa');
    }

    // Verificar que la disputa no está cerrada
    if (dispute.status === DisputeStatus.CLOSED) {
      throw new BadRequestException('No se puede agregar evidencia a una disputa cerrada');
    }

    // Agregar evidencia al array existente
    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        evidence: [...dispute.evidence, ...dto.evidence],
      },
      include: {
        booking: {
          include: {
            service: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedDispute;
  }

  async findAllDisputes(query: QueryDisputesDto) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              service: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      data: disputes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveDispute(disputeId: string, adminId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Disputa no encontrada');
    }

    if (dispute.status === DisputeStatus.CLOSED) {
      throw new BadRequestException('Esta disputa ya fue resuelta');
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        refundAmount: dto.refundAmount,
        resolvedAt: new Date(),
        resolvedBy: adminId,
      },
      include: {
        booking: {
          include: {
            service: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedDispute;
  }

  async getUserDisputeStats(userId: string) {
    const [totalDisputes, totalAsClient, totalAsProvider, openDisputes] = await Promise.all([
      this.prisma.dispute.count({
        where: {
          OR: [{ clientId: userId }, { providerId: userId }],
        },
      }),
      this.prisma.dispute.count({
        where: { clientId: userId },
      }),
      this.prisma.dispute.count({
        where: { providerId: userId },
      }),
      this.prisma.dispute.count({
        where: {
          OR: [{ clientId: userId }, { providerId: userId }],
          status: {
            in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
          },
        },
      }),
    ]);

    return {
      totalDisputes,
      totalAsClient,
      totalAsProvider,
      openDisputes,
    };
  }

  // ==================== HELPERS ====================

  private async validateReportTarget(targetType: string, targetRefId: string) {
    let exists = false;

    switch (targetType) {
      case 'user':
        exists = !!(await this.prisma.user.findUnique({
          where: { id: targetRefId },
        }));
        break;
      case 'service':
        exists = !!(await this.prisma.service.findUnique({
          where: { id: targetRefId },
        }));
        break;
      case 'review':
        exists = !!(await this.prisma.review.findUnique({
          where: { id: targetRefId },
        }));
        break;
      case 'message':
        exists = !!(await this.prisma.message.findUnique({
          where: { id: targetRefId },
        }));
        break;
      default:
        throw new BadRequestException('Tipo de reporte invalido');
    }

    if (!exists) {
      throw new NotFoundException(`${targetType} no encontrado`);
    }
  }
}
