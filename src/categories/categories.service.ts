import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, QueryCategoryDto } from './dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { categoriesSeedData } from './data/categories-seed.data';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCategoryDto) {
    const { page, limit, skip, isActive, isFeatured, parentId } = query;

    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (parentId !== undefined) {
      where.parentId = parentId === 'null' || parentId === null ? null : parentId;
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          subcategories: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: { services: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
    ]);

    return new PaginatedResponseDto(categories, total, page ?? 1, limit ?? 10);
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        parent: true,
        attributes: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { services: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        parent: true,
        attributes: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { services: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con slug ${slug} no encontrada`);
    }

    return category;
  }

  async findRootCategories() {
    return this.prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { services: true },
        },
      },
    });
  }

  async findSubcategories(parentId: string) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(`Categoría padre con ID ${parentId} no encontrada`);
    }

    return this.prisma.category.findMany({
      where: {
        parentId,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { services: true },
        },
      },
    });
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Verificar que el slug no exista
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestException(`Ya existe una categoría con el slug ${slug}`);
    }

    // Verificar que la categoría padre exista si se especifica
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Categoría padre con ID ${dto.parentId} no encontrada`);
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        icon: dto.icon,
        image: dto.image,
        color: dto.color,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        subcategories: true,
        parent: true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    const updateData: any = { ...dto };

    // Si se actualiza el slug, verificar que no exista
    if (updateData.slug && updateData.slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: updateData.slug },
      });

      if (existing) {
        throw new BadRequestException(`Ya existe una categoría con el slug ${updateData.slug}`);
      }
    }

    // Si se actualiza el nombre y no hay slug, generar uno nuevo
    if (updateData.name && !updateData.slug) {
      updateData.slug = this.generateSlug(updateData.name);
      const existing = await this.prisma.category.findUnique({
        where: { slug: updateData.slug },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException(`Ya existe una categoría con el slug ${updateData.slug}`);
      }
    }

    // Verificar que la categoría padre exista si se especifica
    if (updateData.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: updateData.parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Categoría padre con ID ${updateData.parentId} no encontrada`);
      }

      // Evitar ciclos: no puede ser padre de sí misma
      if (updateData.parentId === id) {
        throw new BadRequestException('Una categoría no puede ser padre de sí misma');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        subcategories: true,
        parent: true,
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: true,
        services: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // Verificar que no tenga subcategorías
    if (category.subcategories.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría que tiene subcategorías. Elimine primero las subcategorías.',
      );
    }

    // Verificar que no tenga servicios activos
    if (category.services.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una categoría que tiene servicios asociados. Reasigne los servicios a otra categoría primero.',
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async seed() {
    const createdCategories = [];

    for (const categoryData of categoriesSeedData) {
      // Verificar si ya existe
      const existing = await this.prisma.category.findUnique({
        where: { slug: categoryData.slug },
      });

      if (existing) {
        continue;
      }

      // Crear categoría padre
      const category = await this.prisma.category.create({
        data: {
          name: categoryData.name,
          slug: categoryData.slug,
          description: categoryData.description,
          icon: categoryData.icon,
          color: categoryData.color,
          sortOrder: categoryData.sortOrder,
          isActive: categoryData.isActive,
          isFeatured: categoryData.isFeatured,
        },
      });

      createdCategories.push(category);

      // Crear subcategorías si existen
      if (categoryData.subcategories && categoryData.subcategories.length > 0) {
        for (const subData of categoryData.subcategories) {
          const existingSub = await this.prisma.category.findUnique({
            where: { slug: subData.slug },
          });

          if (!existingSub) {
            await this.prisma.category.create({
              data: {
                name: subData.name,
                slug: subData.slug,
                icon: subData.icon,
                color: subData.color,
                sortOrder: subData.sortOrder,
                isActive: true,
                parentId: category.id,
              },
            });
          }
        }
      }
    }

    return {
      message: 'Seed completado exitosamente',
      categoriesCreated: createdCategories.length,
    };
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
