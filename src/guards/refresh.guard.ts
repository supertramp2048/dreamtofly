import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { log } from "node:console";
import { Observable } from "rxjs";
@Injectable()
export class RefreshGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService
    ) { }
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest()
        const refreshToken = req.cookies['refreshToken']
        if (!refreshToken) return false
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.config.get('jwt.JWT_SECRET')
            })
            //console.log(payload);
            
            req['session'] = payload
            return true
        } catch (error) {
            if (error === 'TokenExpiredError') {
                throw new UnauthorizedException('Access token expired')
            }
            throw new UnauthorizedException()
        }
    }
}