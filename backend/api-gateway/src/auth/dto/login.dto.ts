import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jean.dupont@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Code TOTP, requis si la 2FA est activée sur le compte' })
  @IsOptional()
  @IsString()
  totp_code?: string;
}
