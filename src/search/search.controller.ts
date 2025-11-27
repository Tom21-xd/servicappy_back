import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SaveSearchDto, QuerySearchHistoryDto } from './dto';
import { CurrentUser, Public } from '../common/decorators';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Guarda una búsqueda en el historial
   * POST /search/history
   */
  @Post('history')
  @HttpCode(HttpStatus.CREATED)
  async saveSearch(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveSearchDto,
  ) {
    return this.searchService.saveSearch(userId, dto);
  }

  /**
   * Obtiene el historial de búsquedas del usuario
   * GET /search/history
   */
  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: QuerySearchHistoryDto,
  ) {
    return this.searchService.getHistory(userId, query);
  }

  /**
   * Obtiene estadísticas del historial de búsquedas
   * GET /search/history/stats
   */
  @Get('history/stats')
  async getStats(@CurrentUser('id') userId: string) {
    return this.searchService.getSearchStats(userId);
  }

  /**
   * Elimina una búsqueda específica del historial
   * DELETE /search/history/:id
   */
  @Delete('history/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSearch(
    @CurrentUser('id') userId: string,
    @Param('id') searchId: string,
  ) {
    return this.searchService.deleteSearch(userId, searchId);
  }

  /**
   * Limpia todo el historial de búsquedas
   * DELETE /search/history
   */
  @Delete('history')
  @HttpCode(HttpStatus.OK)
  async clearHistory(@CurrentUser('id') userId: string) {
    return this.searchService.clearHistory(userId);
  }

  /**
   * Obtiene búsquedas populares/trending (público)
   * GET /search/trending
   */
  @Public()
  @Get('trending')
  async getTrending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.searchService.getTrending(parsedLimit);
  }

  /**
   * Obtiene sugerencias de autocompletado
   * GET /search/autocomplete
   */
  @Get('autocomplete')
  async getAutocomplete(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 5;
    return this.searchService.getAutocompleteSuggestions(
      userId,
      query,
      parsedLimit,
    );
  }
}
