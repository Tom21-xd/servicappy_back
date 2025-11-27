import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto, UpdatePromotionDto, ValidatePromotionDto, ApplyReferralDto, QueryPromotionsDto } from './dto';
import { PromotionType } from '@prisma/client';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPromotion(providerId: string, dto: CreatePromotionDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, providerId },
    });

    if (!service) {
      throw new ForbiddenException('No tienes permiso para crear promociones en este servicio');
    }

    const code = dto.code || this.generatePromoCode();

    return this.prisma.servicePromotion.create({
      data: {
        serviceId: dto.serviceId,
        code,
        type: dto.discountType === 'PERCENTAGE' ? PromotionType.PERCENTAGE : PromotionType.FIXED_AMOUNT,
        value: dto.discountValue,
        startsAt: new Date(dto.startDate),
        endsAt: new Date(dto.endDate),
        usageLimit: dto.maxUses,
        minBookingAmount: dto.minPurchaseAmount,
        isActive: dto.isActive ?? true,
      },
      include: {
        service: {
          select: { id: true, title: true },
        },
      },
    });
  }

  async findAllPromotions(providerId: string, query: QueryPromotionsDto) {
    const { serviceId, isActive, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      service: { providerId },
    };

    if (serviceId) where.serviceId = serviceId;
    if (isActive !== undefined) where.isActive = isActive;

    const [promotions, total] = await Promise.all([
      this.prisma.servicePromotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            select: { id: true, title: true },
          },
        },
      }),
      this.prisma.servicePromotion.count({ where }),
    ]);

    return {
      data: promotions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPromotionById(id: string, providerId: string) {
    const promotion = await this.prisma.servicePromotion.findFirst({
      where: {
        id,
        service: { providerId },
      },
      include: {
        service: {
          select: { id: true, title: true },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promocion no encontrada');
    }

    return promotion;
  }

  async updatePromotion(id: string, providerId: string, dto: UpdatePromotionDto) {
    await this.findPromotionById(id, providerId);

    const updateData: any = {};
    if (dto.discountType) {
      updateData.type = dto.discountType === 'PERCENTAGE' ? PromotionType.PERCENTAGE : PromotionType.FIXED_AMOUNT;
    }
    if (dto.discountValue !== undefined) updateData.value = dto.discountValue;
    if (dto.startDate) updateData.startsAt = new Date(dto.startDate);
    if (dto.endDate) updateData.endsAt = new Date(dto.endDate);
    if (dto.maxUses !== undefined) updateData.usageLimit = dto.maxUses;
    if (dto.minPurchaseAmount !== undefined) updateData.minBookingAmount = dto.minPurchaseAmount;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.code) updateData.code = dto.code;

    return this.prisma.servicePromotion.update({
      where: { id },
      data: updateData,
      include: {
        service: {
          select: { id: true, title: true },
        },
      },
    });
  }

  async deletePromotion(id: string, providerId: string) {
    await this.findPromotionById(id, providerId);

    await this.prisma.servicePromotion.delete({
      where: { id },
    });

    return { message: 'Promocion eliminada correctamente' };
  }

  async validatePromotion(dto: ValidatePromotionDto) {
    const promotion = await this.prisma.servicePromotion.findFirst({
      where: {
        code: dto.code,
        serviceId: dto.serviceId,
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    });

    if (!promotion) {
      throw new BadRequestException('Codigo de promocion invalido o expirado');
    }

    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      throw new BadRequestException('Este codigo ha alcanzado el limite de usos');
    }

    if (promotion.minBookingAmount && dto.orderAmount && dto.orderAmount < Number(promotion.minBookingAmount)) {
      throw new BadRequestException('El monto minimo de compra es ' + promotion.minBookingAmount);
    }

    let discount = 0;
    if (promotion.type === PromotionType.PERCENTAGE) {
      discount = (dto.orderAmount || 0) * (Number(promotion.value) / 100);
      if (promotion.maxDiscount) {
        discount = Math.min(discount, Number(promotion.maxDiscount));
      }
    } else {
      discount = Number(promotion.value);
    }

    return {
      valid: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        type: promotion.type,
        value: promotion.value,
      },
      calculatedDiscount: discount,
    };
  }

  async getReferralCode(userId: string) {
    let referral = await this.prisma.referral.findFirst({
      where: { referrerId: userId },
    });

    if (!referral) {
      referral = await this.prisma.referral.create({
        data: {
          referrerId: userId,
          referredId: userId, // El schema requiere referredId, se actualiza cuando alguien usa el codigo
          code: this.generateReferralCode(),
        },
      });
    }

    const successfulReferrals = await this.prisma.referral.count({
      where: {
        referrerId: userId,
        conditionMet: true,
      },
    });

    return {
      code: referral.code,
      successfulReferrals,
      pendingReward: !referral.rewardsClaimed ? referral.referrerReward : null,
    };
  }

  async applyReferralCode(userId: string, dto: ApplyReferralDto) {
    // Verificar si el usuario ya fue referido
    const existingReferral = await this.prisma.referral.findFirst({
      where: { referredId: userId, conditionMet: true },
    });

    if (existingReferral) {
      throw new BadRequestException('Ya has usado un codigo de referido');
    }

    // Buscar el codigo de referido
    const referral = await this.prisma.referral.findFirst({
      where: {
        code: dto.referralCode,
      },
    });

    if (!referral) {
      throw new BadRequestException('Codigo de referido invalido');
    }

    if (referral.referrerId === userId) {
      throw new BadRequestException('No puedes usar tu propio codigo de referido');
    }

    // Crear un nuevo registro de referral para el usuario referido
    const newReferral = await this.prisma.referral.create({
      data: {
        referrerId: referral.referrerId,
        referredId: userId,
        code: dto.referralCode,
        conditionMet: true,
        conditionMetAt: new Date(),
        referrerReward: 10000, // Recompensa por defecto en COP
        referredReward: 5000,
      },
    });

    return {
      message: 'Codigo de referido aplicado correctamente',
      reward: newReferral.referredReward,
    };
  }

  async getMyReferrals(userId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      total: referrals.length,
      completed: referrals.filter(r => r.conditionMet).length,
      pending: referrals.filter(r => !r.conditionMet).length,
      totalRewards: referrals
        .filter(r => r.conditionMet)
        .reduce((sum, r) => sum + Number(r.referrerReward || 0), 0),
    };

    return { referrals, stats };
  }

  private generatePromoCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PROMO-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'REF-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
