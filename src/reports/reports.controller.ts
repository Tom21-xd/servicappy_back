import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  ResolveReportDto,
  CreateDisputeDto,
  ResolveDisputeDto,
  AddEvidenceDto,
  QueryReportsDto,
  QueryDisputesDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ==================== REPORTS ====================

  @Post()
  createReport(@CurrentUser('id') userId: string, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(userId, dto);
  }

  @Get('my-reports')
  findMyReports(@CurrentUser('id') userId: string, @Query() query: QueryReportsDto) {
    return this.reportsService.findMyReports(userId, query);
  }

  @Get('report/:id')
  findReportById(@Param('id') reportId: string, @CurrentUser('id') userId: string) {
    return this.reportsService.findReportById(reportId, userId);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAllReports(@Query() query: QueryReportsDto) {
    return this.reportsService.findAllReports(query);
  }

  @Put('admin/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  resolveReport(
    @Param('id') reportId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolveReport(reportId, adminId, dto);
  }

  // ==================== DISPUTES ====================

  @Post('disputes')
  createDispute(@CurrentUser('id') userId: string, @Body() dto: CreateDisputeDto) {
    return this.reportsService.createDispute(userId, dto);
  }

  @Get('disputes/booking/:bookingId')
  findDisputeByBooking(@Param('bookingId') bookingId: string, @CurrentUser('id') userId: string) {
    return this.reportsService.findDisputeByBooking(bookingId, userId);
  }

  @Put('disputes/:id/evidence')
  addEvidence(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.reportsService.addEvidence(disputeId, userId, dto);
  }

  @Get('disputes/admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAllDisputes(@Query() query: QueryDisputesDto) {
    return this.reportsService.findAllDisputes(query);
  }

  @Put('disputes/admin/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  resolveDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.reportsService.resolveDispute(disputeId, adminId, dto);
  }

  @Get('disputes/stats')
  getUserDisputeStats(@CurrentUser('id') userId: string) {
    return this.reportsService.getUserDisputeStats(userId);
  }
}
