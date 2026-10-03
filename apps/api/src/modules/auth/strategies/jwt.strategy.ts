import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  publicId: string;
  ageTier: string;
  status: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  /**
   * 请求期状态强制：以数据库为准（而非 token 中签发时的快照），使封禁/冻结立即生效——
   * 否则被冻结用户可凭存量 access token（或无限续签的 refresh）继续使用，风控闭环形同虚设。
   * 代价：每个已鉴权请求一次主键查询（MVP 规模可接受；未来可加 Redis 缓存 / tokenVersion）。
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, publicId: true, ageTier: true, status: true, frozenUntil: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: '请重新登录' });

    if (user.status === UserStatus.BANNED) throw new ForbiddenException({ code: 'BANNED', message: '账号已被封禁' });
    if (user.status === UserStatus.DELETED) {
      throw new ForbiddenException({ code: 'ACCOUNT_DELETED', message: '账号已注销' });
    }

    let status: UserStatus = user.status;
    if (status === UserStatus.FROZEN) {
      if (user.frozenUntil && user.frozenUntil > new Date()) {
        throw new ForbiddenException({ code: 'ACCOUNT_FROZEN', message: '账号因违规被临时冻结' });
      }
      // 冻结已到期 → 自动解冻放行（与 login/refresh 行为一致）
      await this.prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE, frozenUntil: null } });
      status = UserStatus.ACTIVE;
    }

    return { userId: user.id, publicId: user.publicId, ageTier: user.ageTier, status };
  }
}
