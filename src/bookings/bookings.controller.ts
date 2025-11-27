import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingStatusDto, RescheduleBookingDto, QueryBookingDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@CurrentUser('id') clientId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(clientId, dto);
  }

  @Get('client')
  findClientBookings(@CurrentUser('id') clientId: string, @Query() query: QueryBookingDto) {
    return this.bookingsService.findClientBookings(clientId, query);
  }

  @Get('provider')
  findProviderBookings(@CurrentUser('id') userId: string, @Query() query: QueryBookingDto) {
    return this.bookingsService.findProviderBookings(userId, query);
  }

  @Get('upcoming/client')
  getUpcomingClientBookings(@CurrentUser('id') userId: string) {
    return this.bookingsService.getUpcoming(userId, 'client');
  }

  @Get('upcoming/provider')
  getUpcomingProviderBookings(@CurrentUser('id') userId: string) {
    return this.bookingsService.getUpcoming(userId, 'provider');
  }

  @Get(':id')
  findOne(@Param('id') bookingId: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.findOne(bookingId, userId);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(bookingId, userId, dto);
  }

  @Put(':id/reschedule')
  reschedule(
    @Param('id') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.reschedule(bookingId, userId, dto);
  }
}
