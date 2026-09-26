import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  // Heure (secondes epoch) de la connexion d'origine — cf. requireRecentAuth.
  auth_time?: number;
  iat?: number;
}

export const CurrentUser = createParamDecorator(
  (_decoratorData: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest()["user"],
);
