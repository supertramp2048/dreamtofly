import { Inject, Injectable } from '@nestjs/common';
import { CreateAuthSessionDto } from './dto/create-auth-session.dto';
import { UpdateAuthSessionDto } from './dto/update-auth-session.dto';
import { Repository } from 'typeorm';
import { AuthSession } from './entities/auth-session.entity';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms'
import { randomUUID } from 'crypto'
import { IAuthSession } from './interfaces/authSession.intrface';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'
import { AuthSessionStatus } from './enum/sessionStatus.enum';
import { PageOptionsDto } from 'src/common/pagination/dto/pageOption.dto';
import { QueryBuilder } from 'typeorm/browser';
import { paginate } from 'src/common/pagination/helper/pagination.helper';
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
  ) { }
  async create(createAuthSessionDto: CreateAuthSessionDto) {
    const sid = randomUUID()

    const expiresIn = this.config.get<string>('jwt.JWT_REFRESH_EXPIRES')
    if (!expiresIn) {
      throw new Error('httpOnlyExpires not set')
    }
    const expiredDay = new Date(Date.now() + ms(expiresIn as StringValue))

    const payload = { userId: Number(createAuthSessionDto.userId), sid: sid,email: createAuthSessionDto.email }
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.JWT_SECRET'),
      expiresIn: this.config.get('jwt.JWT_REFRESH_EXPIRES')
    })
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
    const authSession: IAuthSession = {
      sid: sid,
      userId: Number(createAuthSessionDto.userId),
      refreshTokenHash: refreshTokenHash,
      expiresAt: expiredDay
    }
    const res = await this.authSessionRepository.save(authSession)
    return refreshToken;
  }

  async findAll(pageOptionDto: PageOptionsDto) {
    const queryBuilder = this.authSessionRepository.createQueryBuilder('AuthSession');


    return await paginate(queryBuilder,pageOptionDto,"AuthSession");
  }

  async findOne(sid: string) {
    const session = await this.authSessionRepository.findOneBy({sid})
    
    if (!session) {
      throw new Error('Session not found')
    }
    
    // Check if session has expired
    if (session.expiresAt && new Date() > session.expiresAt) {
      throw new Error('Session expired')
    }
    
    return session
  }

  async update(sid: string) {
    return this.authSessionRepository.update(
    { sid: sid, status: AuthSessionStatus.REVOKED },
    {
      status: AuthSessionStatus.ACTIVE,
      createdAt: new Date(),
    },
  )
  }
  removeOne(sid: string) {
    return this.authSessionRepository.update(
    { sid: sid, status: AuthSessionStatus.ACTIVE },
    {
      status: AuthSessionStatus.REVOKED,
      revokedAt: new Date(),
      revokeReason: 'LOGOUT_ONE',
    },
  )
  }
  remove(userId: number) {
    return this.authSessionRepository.update(
    { userId, status: AuthSessionStatus.ACTIVE },
    {
      status: AuthSessionStatus.REVOKED,
      revokedAt: new Date(),
      revokeReason: 'LOGOUT_ALL',
    },
  )
  }
}
