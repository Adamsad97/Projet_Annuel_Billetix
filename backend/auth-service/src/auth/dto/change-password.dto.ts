import { IsString } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  current_password: string;

  // Longueur et complexité : AuthService.assertPasswordPolicy()
  // (minimum paramétrable via platform_settings).
  @IsString()
  new_password: string;
}
