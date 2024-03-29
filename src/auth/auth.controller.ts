import { Body, Controller, Post, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateUserDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  VerifyTokenDto,
} from './dto';
import { Public } from 'src/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @Public()
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('/login')
  @Public()
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('/resetPassword')
  @Public()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('/verifyToken')
  @Public()
  async verifyToken(@Body() dto: VerifyTokenDto) {
    console.log('verifytoken');
    return this.authService.verifyToken(dto.email, dto.token);
  }

  @Post('/forgotPassword')
  @Public()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Get('/test')
  @Public()
  async test() {
    return 'test';
  }
}
