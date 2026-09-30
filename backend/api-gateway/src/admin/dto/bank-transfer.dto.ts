import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SepaExportDto {
  /** Reversements à inclure ; absent : tous les reversements « À virer ». */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("all", { each: true })
  ids?: string[];
}

export class ConfirmBankTransfersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID("all", { each: true })
  ids: string[];

  /** Référence du virement (ou de l'ordre groupé) donnée par la banque. */
  @ApiProperty({ example: "BTX-20261001-0001" })
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  reference: string;
}
