import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_decoratorData: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest()["user"],
);
