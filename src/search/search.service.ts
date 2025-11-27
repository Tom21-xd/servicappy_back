import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveSearchDto, QuerySearchHistoryDto } from './dto';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Guarda una búsqueda en el historial del usuario
   * Mantiene solo las últimas 50 búsquedas por usuario
   */
  async saveSearch(userId: string, dto: SaveSearchDto) {
    // Contar búsquedas actuales del usuario
    const count = await this.prisma.searchHistory.count({
      where: { userId },
    });

    // Si ya tiene 50 o más, eliminar las más antiguas
    if (count >= 50) {
      const toDelete = count - 49; // Dejar espacio para la nueva
      const oldestSearches = await this.prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: toDelete,
        select: { id: true },
      });

      await this.prisma.searchHistory.deleteMany({
        where: {
          id: {
            in: oldestSearches.map((s) => s.id),
          },
        },
      });
    }

    // Guardar nueva búsqueda
    return this.prisma.searchHistory.create({
      data: {
        userId,
        query: dto.query,
        filters: dto.filters || null,
        resultsCount: dto.resultsCount,
      },
    });
  }

  /**
   * Obtiene el historial de búsquedas del usuario con paginación
   */
  async getHistory(userId: string, query: QuerySearchHistoryDto) {
    const { skip, limit } = query;

    const [searches, total] = await Promise.all([
      this.prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.searchHistory.count({
        where: { userId },
      }),
    ]);

    return {
      data: searches,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Elimina una búsqueda específica del historial
   */
  async deleteSearch(userId: string, searchId: string) {
    const search = await this.prisma.searchHistory.findFirst({
      where: {
        id: searchId,
        userId,
      },
    });

    if (!search) {
      throw new NotFoundException('Búsqueda no encontrada');
    }

    await this.prisma.searchHistory.delete({
      where: { id: searchId },
    });

    return { message: 'Búsqueda eliminada correctamente' };
  }

  /**
   * Limpia todo el historial de búsquedas del usuario
   */
  async clearHistory(userId: string) {
    const { count } = await this.prisma.searchHistory.deleteMany({
      where: { userId },
    });

    return {
      message: 'Historial limpiado correctamente',
      deletedCount: count,
    };
  }

  /**
   * Obtiene las búsquedas más populares de los últimos 7 días
   * Agrupa por query y cuenta las ocurrencias
   */
  async getTrending(limit: number = 10) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Obtener búsquedas de los últimos 7 días
    const recentSearches = await this.prisma.searchHistory.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        query: true,
      },
    });

    // Agrupar y contar manualmente
    const queryCount: Record<string, number> = {};

    recentSearches.forEach((search) => {
      const normalizedQuery = search.query.toLowerCase().trim();
      if (normalizedQuery) {
        queryCount[normalizedQuery] = (queryCount[normalizedQuery] || 0) + 1;
      }
    });

    // Convertir a array y ordenar por cantidad
    const trending = Object.entries(queryCount)
      .map(([query, count]) => ({
        query,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return trending;
  }

  /**
   * Obtiene sugerencias de autocompletado basadas en el historial del usuario
   * Busca búsquedas que comiencen con el texto ingresado
   */
  async getAutocompleteSuggestions(userId: string, text: string, limit: number = 5) {
    if (!text || text.trim().length < 2) {
      return [];
    }

    const normalizedText = text.toLowerCase().trim();

    // Buscar en el historial del usuario
    const searches = await this.prisma.searchHistory.findMany({
      where: {
        userId,
        query: {
          contains: normalizedText,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      distinct: ['query'],
    });

    // Retornar solo las queries únicas
    const uniqueQueries = Array.from(
      new Set(searches.map((s) => s.query.trim())),
    ).slice(0, limit);

    return uniqueQueries.map((query) => ({ suggestion: query }));
  }

  /**
   * Obtiene estadísticas del historial de búsquedas del usuario
   */
  async getSearchStats(userId: string) {
    const [totalSearches, uniqueQueries, recentSearches] = await Promise.all([
      this.prisma.searchHistory.count({
        where: { userId },
      }),
      this.prisma.searchHistory.groupBy({
        by: ['query'],
        where: { userId },
      }),
      this.prisma.searchHistory.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
          },
        },
      }),
    ]);

    return {
      totalSearches,
      uniqueSearches: uniqueQueries.length,
      last24Hours: recentSearches,
    };
  }
}
