import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderProfileDto, UpdateProviderProfileDto, SetAvailabilityDto, SpecialDateDto, PortfolioDto, QueryProviderDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('providers')
@UseGuards(JwtAuthGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post('profile')
  createProfile(@CurrentUser('id') userId: string, @Body() dto: CreateProviderProfileDto) {
    return this.providersService.createProfile(userId, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.providersService.getProfile(userId);
  }

  @Put('profile')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProviderProfileDto) {
    return this.providersService.updateProfile(userId, dto);
  }

  @Put('availability')
  setAvailability(@CurrentUser('id') userId: string, @Body() dto: SetAvailabilityDto) {
    return this.providersService.setAvailability(userId, dto);
  }

  @Get('availability')
  getAvailability(@CurrentUser('id') userId: string) {
    return this.providersService.getAvailability(userId);
  }

  @Post('special-dates')
  addSpecialDate(@CurrentUser('id') userId: string, @Body() dto: SpecialDateDto) {
    return this.providersService.addSpecialDate(userId, dto);
  }

  @Delete('special-dates/:id')
  removeSpecialDate(@CurrentUser('id') userId: string, @Param('id') dateId: string) {
    return this.providersService.removeSpecialDate(userId, dateId);
  }

  @Put('portfolio')
  updatePortfolio(@CurrentUser('id') userId: string, @Body() dto: PortfolioDto) {
    return this.providersService.updatePortfolio(userId, dto);
  }

  @Get('stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.providersService.getProviderStats(userId);
  }

  @Public()
  @Get('search')
  searchProviders(@Query() query: QueryProviderDto) {
    return this.providersService.searchProviders(query);
  }

  @Public()
  @Get(':id')
  getPublicProfile(@Param('id') providerId: string) {
    return this.providersService.getPublicProfile(providerId);
  }
}
