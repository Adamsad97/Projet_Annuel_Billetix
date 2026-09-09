import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password: string;

  @ApiProperty({ example: "NouveauMotDePasse123!", minLength: 8 })
  @IsString()
  @MinLength(8)
  new_password: string;
}
