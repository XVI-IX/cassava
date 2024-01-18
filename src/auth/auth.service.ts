import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  CreateUserDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  private async getUserByEmail(user_email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: user_email,
        },
        select: {
          email: true,
          username: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User could not be found.');
      }

      return user;
    } catch (error) {
      throw new InternalServerErrorException('Please try again.');
    }
  }

  private randomDigits() {
    return randomBytes(3).toString('hex');
  }

  async register(dto: CreateUserDto) {
    try {
      const passwordhash = await argon.hash(dto.password);

      const newUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          firstname: dto.firstname,
          lastname: dto.lastname,
          passwordhash: passwordhash,
          verified: false,
          deviceTokens: [dto.deviceToken],
        },
        select: {
          email: true,
          username: true,
        },
      });

      if (!newUser) {
        throw new InternalServerErrorException('User could not registered.');
      }

      // await

      const email_data = {
        to: dto.email,
        data: {
          name: dto.username,
        },
      };

      this.emitter.emit('welcome-email', email_data);

      return {
        message: 'User registered.',
        status: 'Success',
        statusCode: 201,
        data: newUser,
      };
    } catch (error) {
      console.error(error);
      if (error.code === 'p2002') {
        throw new BadRequestException('User already exists');
      }
      throw new InternalServerErrorException('Registration failed.');
    }
  }

  async login(dto: LoginDto): Promise<{ access_token: string } | object> {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
        select: {
          id: true,
          email: true,
          username: true,
          passwordhash: true,
          verified: true,
        },
      });

      const match = await argon.verify(user.passwordhash, dto.password);
      if (!match) {
        throw new UnauthorizedException('Invalid password');
      }

      const payload = {
        sub: user.id,
        email: user.email,
      };
      const token = await this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRE'),
      });

      return {
        access_token: token,
      };
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Login failed, try again.');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    try {
      const user = await this.getUserByEmail(dto.email);

      const resetToken = this.randomDigits();

      await this.prisma.user.update({
        where: {
          email: user.email,
        },
        data: {
          resetToken: resetToken,
        },
      });

      const data = {
        to: user.email,
        data: {
          name: user.username,
          token: resetToken,
        },
      };

      this.emitter.emit('send-verification', data);

      return {
        message: 'Reset token has been sent to your email',
        status: 'success',
        statusCode: 200,
        data: null,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Retrieving password failed.');
    }
  }

  async verifyToken(email: string, token: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email,
        },
        select: {
          resetToken: true,
        },
      });

      console.log(user.resetToken, token);

      if (!user) {
        throw new NotFoundException('User could not be found.');
      }

      if (token !== user.resetToken) {
        throw new BadRequestException('Invalid OTP');
      }

      await this.prisma.user.update({
        where: {
          email: email,
        },
        data: {
          verified: true,
        },
      });

      return {
        message: 'Valid Token',
        status: 'success',
        statusCode: 200,
        data: {
          token: user.resetToken,
        },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Token could not be verified.');
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const passwordhash = await argon.hash(dto.newPassword);

      const updatedUser = await this.prisma.user.update({
        where: {
          resetToken: dto.resetToken,
        },
        data: {
          passwordhash: passwordhash,
          resetToken: null,
        },
      });

      if (!updatedUser) {
        throw new InternalServerErrorException('Password could not be reset');
      }

      this.emitter.emit('password-reset-mail', {
        to: updatedUser.email,
        data: {
          name: updatedUser.username,
        },
      });

      return {
        message: 'Password Reset successfully.',
        status: 'success',
        statusCode: 200,
        data: null,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Password could not be reset.');
    }
  }
}
