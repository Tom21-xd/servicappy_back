import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':serviceId')
  toggleFavorite(@CurrentUser('id') userId: string, @Param('serviceId') serviceId: string) {
    return this.favoritesService.toggleFavorite(userId, serviceId);
  }

  @Get()
  getFavorites(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.favoritesService.getFavorites(userId, query);
  }

  @Get('check/:serviceId')
  checkIsFavorite(@CurrentUser('id') userId: string, @Param('serviceId') serviceId: string) {
    return this.favoritesService.checkIsFavorite(userId, serviceId);
  }

  @Post('check-multiple')
  checkMultipleFavorites(
    @CurrentUser('id') userId: string,
    @Body() body: { serviceIds: string[] },
  ) {
    return this.favoritesService.checkMultipleFavorites(userId, body.serviceIds);
  }

  @Delete(':id')
  removeFavorite(@CurrentUser('id') userId: string, @Param('id') favoriteId: string) {
    return this.favoritesService.removeFavorite(userId, favoriteId);
  }
}
