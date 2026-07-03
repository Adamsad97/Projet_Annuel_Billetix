import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString } from 'class-validator';

enum OAuthProvider {
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
}

export class OAuthLoginDto {
  @ApiProperty({ enum: OAuthProvider })
  @IsEnum(OAuthProvider)
  provider: OAuthProvider;

  @ApiProperty({ description: 'ID utilisateur retourné par le provider OAuth' })
  @IsString()
  oauth_id: string;

  @ApiProperty({ example: 'jean.dupont@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  first_name: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  last_name: string;
}
