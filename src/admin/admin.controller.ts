import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== DASHBOARD ====================

  /**
   * Obtener estadísticas del dashboard
   * GET /admin/dashboard
   */
  @Get('dashboard')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  /**
   * Obtener actividad reciente
   * GET /admin/activity
   */
  @Get('activity')
  getRecentActivity(@Query('limit') limit?: number) {
    return this.adminService.getRecentActivity(limit);
  }

  // ==================== USER MANAGEMENT ====================

  /**
   * Listar usuarios
   * GET /admin/users
   */
  @Get('users')
  findAllUsers(@Query() query: QueryUsersDto) {
    return this.adminService.findAllUsers(query);
  }

  /**
   * Obtener usuario por ID
   * GET /admin/users/:id
   */
  @Get('users/:id')
  getUserById(@Param('id') userId: string) {
    return this.adminService.getUserById(userId);
  }

  /**
   * Actualizar estado de usuario
   * PUT /admin/users/:id/status
   */
  @Put('users/:id/status')
  updateUserStatus(
    @Param('id') userId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(userId, adminId, dto);
  }

  /**
   * Actualizar rol de usuario
   * PUT /admin/users/:id/role
   */
  @Put('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN) // Solo SUPER_ADMIN puede cambiar roles
  updateUserRole(
    @Param('id') userId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(userId, adminId, dto);
  }

  // ==================== SERVICE MODERATION ====================

  /**
   * Listar servicios para moderación
   * GET /admin/services
   */
  @Get('services')
  findAllServicesAdmin(@Query() query: QueryServicesAdminDto) {
    return this.adminService.findAllServicesAdmin(query);
  }

  /**
   * Moderar servicio (aprobar/rechazar)
   * PUT /admin/services/:id/moderate
   */
  @Put('services/:id/moderate')
  moderateService(
    @Param('id') serviceId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ModerateServiceDto,
  ) {
    return this.adminService.moderateService(serviceId, adminId, dto);
  }

  // ==================== BANNERS ====================

  /**
   * Listar banners
   * GET /admin/banners
   */
  @Get('banners')
  findAllBanners() {
    return this.adminService.findAllBanners();
  }

  /**
   * Crear banner
   * POST /admin/banners
   */
  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.adminService.createBanner(dto);
  }

  /**
   * Actualizar banner
   * PUT /admin/banners/:id
   */
  @Put('banners/:id')
  updateBanner(@Param('id') bannerId: string, @Body() dto: UpdateBannerDto) {
    return this.adminService.updateBanner(bannerId, dto);
  }

  /**
   * Eliminar banner
   * DELETE /admin/banners/:id
   */
  @Delete('banners/:id')
  deleteBanner(@Param('id') bannerId: string) {
    return this.adminService.deleteBanner(bannerId);
  }

  // ==================== SYSTEM CONFIG ====================

  /**
   * Obtener todas las configuraciones
   * GET /admin/config
   */
  @Get('config')
  @Roles(UserRole.SUPER_ADMIN)
  getAllConfigs() {
    return this.adminService.getAllConfigs();
  }

  /**
   * Obtener configuración por key
   * GET /admin/config/:key
   */
  @Get('config/:key')
  @Roles(UserRole.SUPER_ADMIN)
  getConfig(@Param('key') key: string) {
    return this.adminService.getConfig(key);
  }

  /**
   * Crear/Actualizar configuración
   * POST /admin/config
   */
  @Post('config')
  @Roles(UserRole.SUPER_ADMIN)
  setConfig(@Body() dto: SetConfigDto) {
    return this.adminService.setConfig(dto);
  }

  /**
   * Eliminar configuración
   * DELETE /admin/config/:key
   */
  @Delete('config/:key')
  @Roles(UserRole.SUPER_ADMIN)
  deleteConfig(@Param('key') key: string) {
    return this.adminService.deleteConfig(key);
  }

  // ==================== ACTIVITY LOGS ====================

  /**
   * Obtener logs de actividad
   * GET /admin/logs
   */
  @Get('logs')
  @Roles(UserRole.SUPER_ADMIN)
  getActivityLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getActivityLogs(page, limit);
  }
}
