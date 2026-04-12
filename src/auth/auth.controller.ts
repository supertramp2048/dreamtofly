import { Body, Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { SignInDto } from './dto/signIn.dto';
import { AuthService } from './auth.service';
import { Res } from '@nestjs/common';
import  type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/customeDecorator/setPublicRoute.decorator';
import { GetUser } from 'src/customeDecorator/getUser.decorator';
import { RefreshGuard } from 'src/guards/refresh.guard';
import { GetSesion } from 'src/customeDecorator/getSession.decorator';
import { GetRefreshToken } from 'src/customeDecorator/getRefreshToken.decorator';
import { CheckSingIn } from 'src/guards/checkSingIn.guard';
@Controller('auth')
export class AuthController {
    constructor(
        private readonly config: ConfigService,
        private authService: AuthService
    ){}
    @Post('signIn')
    @UseGuards(CheckSingIn)
    @Public()
    async signIn(@Body() acc:SignInDto, @Res({ passthrough: true }) res: Response){
        const result = await this.authService.signIn(acc)
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: true,        // true khi dùng HTTPS
            sameSite: 'strict',  // hoặc 'lax'
            maxAge:  Number(this.config.get('httpOnlyExpires'))* 24 * 60 * 60 * 1000, // 7 ngày
        })
        return {accesstoken: result.accessToken}
    }
    @Get('signOut')
    async signOut(@GetUser() user: any,@Res({ passthrough: true }) res: Response){
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            // Nếu lúc set có truyền path hoặc domain thì lúc clear cũng phải truyền y hệt
        });
        return await this.authService.signOut(user)
    }
    @Get('refresh')
    @Public()
    @UseGuards(RefreshGuard)
    async refresh(@GetSesion() session: any, @GetRefreshToken() refreshToken: string){
        
        return await this.authService.refreshAccessToken(session, refreshToken)
    }

    @Get('myprofile')
    async myProfile(@GetUser() user: any) {
        return await this.authService.getMyProfile(user)
    }

}
