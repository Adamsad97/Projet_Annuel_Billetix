import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NouveauMotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  new_password: string;
}
