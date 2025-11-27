import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto, ValidatePromotionDto, ApplyReferralDto, QueryPromotionsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('promotions')
@UseGuards(JwtAuthGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // ==================== PROMOTIONS (Provider) ====================

  /**
   * Crear una promoción para un servicio
   * POST /promotions
   */
  @Post()
  createPromotion(@CurrentUser('id') userId: string, @Body() dto: CreatePromotionDto) {
    return this.promotionsService.createPromotion(userId, dto);
  }

  /**
   * Listar promociones del proveedor
   * GET /promotions
   */
  @Get()
  findAllPromotions(@CurrentUser('id') userId: string, @Query() query: QueryPromotionsDto) {
    return this.promotionsService.findAllPromotions(userId, query);
  }

  /**
   * Obtener una promoción por ID
   * GET /promotions/:id
   */
  @Get(':id')
  findPromotionById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.promotionsService.findPromotionById(id, userId);
  }

  /**
   * Actualizar una promoción
   * PUT /promotions/:id
   */
  @Put(':id')
  updatePromotion(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.updatePromotion(id, userId, dto);
  }

  /**
   * Eliminar una promoción
   * DELETE /promotions/:id
   */
  @Delete(':id')
  deletePromotion(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.promotionsService.deletePromotion(id, userId);
  }

  /**
   * Validar un código de promoción
   * POST /promotions/validate
   */
  @Post('validate')
  validatePromotion(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validatePromotion(dto);
  }

  // ==================== REFERRALS ====================

  /**
   * Obtener mi código de referido
   * GET /promotions/referral/my-code
   */
  @Get('referral/my-code')
  getReferralCode(@CurrentUser('id') userId: string) {
    return this.promotionsService.getReferralCode(userId);
  }

  /**
   * Aplicar un código de referido
   * POST /promotions/referral/apply
   */
  @Post('referral/apply')
  applyReferralCode(@CurrentUser('id') userId: string, @Body() dto: ApplyReferralDto) {
    return this.promotionsService.applyReferralCode(userId, dto);
  }

  /**
   * Ver mis referidos
   * GET /promotions/referral/my-referrals
   */
  @Get('referral/my-referrals')
  getMyReferrals(@CurrentUser('id') userId: string) {
    return this.promotionsService.getMyReferrals(userId);
  }
}
