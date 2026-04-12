import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Context } from "vm";

export const GetRefreshToken = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest()
        const refreshToken = req.cookies['refreshToken']
        return refreshToken
    }
)