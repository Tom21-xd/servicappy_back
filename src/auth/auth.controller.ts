import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, TokensDto } from './dto';
import { Public, CurrentUser } from '../common';
import { LocalAuthGuard } from './guards';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<TokensDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req): Promise<TokensDto> {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokensDto> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  async logout(@CurrentUser() user: any) {
    return {
      message: 'Sesión cerrada exitosamente',
    };
  }

  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    const user = await this.authService['prisma'].user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        phone: true,
        createdAt: true,
      },
    });

    return user;
  }
}
