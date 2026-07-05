import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class CreateOrganizerProfileDto {
  @ApiProperty({ example: "Les Nuits de Paris" })
  @IsString()
  @MinLength(2)
  display_name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  logo_url?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  website_url?: string;
}
