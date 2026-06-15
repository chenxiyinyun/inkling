import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConsentStatus, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { deriveAgeDecision } from './age.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({ code: 'IDENTIFIER_REQUIRED', message: '请提供邮箱或手机号' });
    }

    const hardFloor = this.config.get<number>('minAgeHardFloor') ?? 13;
    const guardianBelow = this.config.get<number>('guardianModeBelowAge') ?? 18;
    const { tier: ageTier, isMinor, belowFloor } = deriveAgeDecision(new Date(dto.birthDate), hardFloor, guardianBelow);

    // 年龄硬门控（未成年人保护，详见 docs/安全与未成年人保护.md）
    if (belowFloor) {
      throw new ForbiddenException({
        code: 'AGE_BELOW_FLOOR',
        message: '漂流邮局暂时不能为你开启航行。待你长大些，海面会一直在。',
      });
    }

    // 唯一性校验
    const existing = await this.prisma.user.findFirst({
      where: { OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(Boolean) as any },
    });
    if (existing) throw new ConflictException({ code: 'ALREADY_REGISTERED', message: '这个邮箱/手机号已注册' });

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        ageTier,
        birthDate: new Date(dto.birthDate),
        profile: {
          create: {
            penName: dto.penName,
            guardianMode: isMinor, // 未成年默认开启守护模式
          },
        },
        ...(isMinor
          ? {
              parentalConsent: {
                create: { method: 'self-declared', status: ConsentStatus.PENDING },
              },
            }
          : {}),
      },
    });

    return { ...this.issueTokens(user), ageTier, guardianMode: isMinor };
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({ code: 'IDENTIFIER_REQUIRED', message: '请提供邮箱或手机号' });
    }
    const user = await this.prisma.user.findFirst({
      where: { OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(Boolean) as any },
    });
    if (!user) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '账号或密码不对' });
    if (user.status === 'BANNED') throw new ForbiddenException({ code: 'BANNED', message: '账号已被封禁' });

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '账号或密码不对' });

    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return this.issueTokens(user);
  }

  private issueTokens(user: User) {
    const payload = { sub: user.id, publicId: user.publicId, ageTier: user.ageTier, status: user.status };
    const accessToken = this.jwt.sign(payload, { expiresIn: this.config.get<string>('jwt.accessTtl') ?? '15m' });
    const refreshToken = this.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: this.config.get<string>('jwt.refreshTtl') ?? '30d' });
    return { accessToken, refreshToken, publicId: user.publicId };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('no user');
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: '请重新登录' });
    }
  }
}
