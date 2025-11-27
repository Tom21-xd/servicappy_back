import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, QueryServiceDto } from './dto';
import { Public, CurrentUser, Roles } from '../common';
import { RolesGuard } from '../common/guards';
import { UserRole } from '@prisma/client';

@Controller('services')
@UseGuards(RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryServiceDto) {
    return this.servicesService.findAll(query);
  }

  @Public()
  @Get('search')
  search(@Query() query: QueryServiceDto) {
    return this.servicesService.findAll(query);
  }

  @Public()
  @Get('featured')
  findFeatured(@Query() query: QueryServiceDto) {
    const featuredQuery = Object.assign(new QueryServiceDto(), query, { isFeatured: true, isActive: true });
    return this.servicesService.findAll(featuredQuery);
  }

  @Public()
  @Get('nearby')
  findNearby(@Query() query: QueryServiceDto) {
    const nearbyQuery = Object.assign(new QueryServiceDto(), query, { isActive: true });
    return this.servicesService.findAll(nearbyQuery);
  }

  @Get('my')
  @Roles(UserRole.PROVIDER)
  findMy(@CurrentUser('id') userId: string, @Query() query: QueryServiceDto) {
    return this.servicesService.findByProvider(userId, query);
  }

  @Public()
  @Get('provider/:providerId')
  findByProvider(
    @Param('providerId') providerId: string,
    @Query() query: QueryServiceDto,
  ) {
    const providerQuery = Object.assign(new QueryServiceDto(), query, { isActive: true });
    return this.servicesService.findByProvider(providerId, providerQuery);
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const service = await this.servicesService.findOne(id);
    this.servicesService.incrementViewCount(id).catch(() => {});
    return service;
  }

  @Post()
  @Roles(UserRole.PROVIDER)
  create(@CurrentUser('id') userId: string, @Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(userId, createServiceDto);
  }

  @Patch(':id')
  @Roles(UserRole.PROVIDER)
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, userId, updateServiceDto);
  }

  @Delete(':id')
  @Roles(UserRole.PROVIDER)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.servicesService.remove(id, userId);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.PROVIDER)
  toggleActive(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.servicesService.toggleActive(id, userId);
  }

  @Patch(':id/toggle-featured')
  @Roles(UserRole.ADMIN)
  toggleFeatured(@Param('id') id: string) {
    return this.servicesService.toggleFeatured(id);
  }
}
