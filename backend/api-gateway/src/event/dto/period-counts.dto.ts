import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString, Matches, ValidateNested } from "class-validator";

/** Période du filtre Date (« today », « weekend »…), bornes calculées par le site. */
export class PeriodDto {
  @ApiProperty({ example: "today" })
  @IsString()
  @Matches(/^[a-z_]{1,20}$/)
  key: string;

  @ApiProperty({ example: "2026-10-01T10:00:00.000Z" })
  @IsDateString()
  from: string;

  @ApiPropertyOptional({ example: "2026-10-01T21:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PeriodCountsDto {
  @ApiProperty({ type: [PeriodDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PeriodDto)
  periods: PeriodDto[];
}
