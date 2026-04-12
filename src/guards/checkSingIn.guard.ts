import { CanActivate, ExecutionContext, Injectable, PreconditionFailedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

@Injectable() 
export class CheckSingIn implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const refreshToken = req.cookies['refreshToken'];

        if (!refreshToken) {
            return true;
        }

        try {
            await this.jwtService.verifyAsync(refreshToken, {
                secret: this.config.get('jwt.JWT_SECRET')
            });

            throw new PreconditionFailedException({
                message: "You have already signed in",
                code: "ALREADY_SIGNED_IN"
            });
        } catch (error) {
            if (error instanceof PreconditionFailedException) {
                throw error; 
            }
            return true; 
        }
    }
}