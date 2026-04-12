import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { SignInDto } from './dto/signIn.dto';
import { Repository } from 'typeorm';

import { AuthSessionService } from 'src/auth-session/auth-session.service';
import * as bcrypt from "bcrypt"
import { ConfigService } from '@nestjs/config';
import { log } from 'console';
@Injectable()
export class AuthService {
    constructor(
        private readonly config: ConfigService,
        private authSessionService: AuthSessionService,
        private userService: UsersService,
        private jwtService: JwtService
    ) { }
    async signIn(acc: SignInDto): Promise<{ accessToken: string, refreshToken: string }> {
        const user = await this.userService.findOneByEmail(acc.email)
        if (!user || !user.data) {
            throw new UnauthorizedException('Invalid credentials')
        }
        const isPassMatch = await bcrypt.compare(acc.password, user.data?.password)
        if (!isPassMatch) {
            throw new UnauthorizedException();
        }
        const payload = { userId: user.data.id, email: user.data.email }
        const objSession = {
            userId: user.data.id,
            email: user.data.email
        }
        const session = await this.authSessionService.create(objSession)
        const refreshToken = session

        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.config.get('jwt.JWT_SECRET'),
            expiresIn: this.config.get('jwt.JWT_ACCESS_EXPIRES'),
        })

        return {
            accessToken,
            refreshToken
        }
    }


    async signOut(data: any) {
        return this.authSessionService.remove(data.userId)
    }

    async refreshAccessToken(session: any, refreshToken: string) {
        const payload = { userId: session.userId, email: session.email }
        const sid: string = session.sid
        let res
        try {
            res = await this.authSessionService.findOne(sid)
        } catch (error) {
            throw new UnauthorizedException(error)
        }
        const refreshTokenHash = res?.refreshTokenHash
        let isMatch = await bcrypt.compare(refreshToken, refreshTokenHash)
        if (!isMatch) throw new UnauthorizedException('Invalid refresh token')
        const newAccessToken = await this.jwtService.signAsync(payload, {
            secret: this.config.get('jwt.JWT_SECRET'),
            expiresIn: this.config.get('jwt.JWT_ACCESS_EXPIRES'),
        })
        return {
            newAccessToken
        }
    }

    async getMyProfile(user: { userId?: string }) {
        const userId = user?.userId
        if (!userId) {
            throw new UnauthorizedException('Missing user')
        }
        const res = await this.userService.findOne(userId)
        if (!res?.data) {
            throw new NotFoundException('User not found')
        }
        const { id, name, email, status, createdAt, updatedAt } = res.data
        return { id, name, email, status, createdAt, updatedAt }
    }
}
