import { IsString } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  token: string;

  // Longueur et complexité : AuthService.assertPasswordPolicy()
  // (minimum paramétrable via platform_settings).
  @IsString()
  new_password: string;
}
