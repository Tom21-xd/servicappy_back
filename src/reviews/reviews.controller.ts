import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ProviderResponseDto, QueryReviewDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(@CurrentUser('id') clientId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(clientId, dto);
  }

  @Get('my-reviews')
  getMyReviews(@CurrentUser('id') clientId: string, @Query() query: QueryReviewDto) {
    return this.reviewsService.getClientReviews(clientId, query);
  }

  @Public()
  @Get('provider/:providerId')
  findProviderReviews(@Param('providerId') providerId: string, @Query() query: QueryReviewDto) {
    return this.reviewsService.findProviderReviews(providerId, query);
  }

  @Public()
  @Get('service/:serviceId')
  findServiceReviews(@Param('serviceId') serviceId: string, @Query() query: QueryReviewDto) {
    return this.reviewsService.findServiceReviews(serviceId, query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') reviewId: string) {
    return this.reviewsService.findOne(reviewId);
  }

  @Post(':id/response')
  addProviderResponse(
    @Param('id') reviewId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ProviderResponseDto,
  ) {
    return this.reviewsService.addProviderResponse(reviewId, userId, dto);
  }
}
