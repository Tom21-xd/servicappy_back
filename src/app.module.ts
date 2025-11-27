import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { JwtAuthGuard } from './auth/guards';
import { AllExceptionsFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard global de JWT - todas las rutas requieren auth excepto @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Filter global de excepciones
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Interceptor global para formato de respuesta
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
