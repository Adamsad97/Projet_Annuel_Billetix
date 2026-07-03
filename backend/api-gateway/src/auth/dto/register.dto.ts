import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

enum RegistrableRole {
  BUYER = 'BUYER',
  ORGANIZER = 'ORGANIZER',
}

export class RegisterDto {
  @ApiProperty({ example: 'jean.dupont@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  first_name: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  last_name: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: RegistrableRole, default: RegistrableRole.BUYER })
  @IsEnum(RegistrableRole)
  @IsOptional()
  role?: RegistrableRole;
}
