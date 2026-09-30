import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { ReasonDto } from "../../common/dto/common.dto";

export enum ChangeRequestKind {
  CANCELLATION = "CANCELLATION",
  POSTPONEMENT = "POSTPONEMENT",
}

/** Demande d'annulation ou de report ; report : nouvelle date facultative (« date à venir »). */
export class ChangeRequestDto extends ReasonDto {
  @ApiPropertyOptional({ enum: ChangeRequestKind, default: ChangeRequestKind.CANCELLATION })
  @IsOptional()
  @IsEnum(ChangeRequestKind, { message: "Type de demande invalide." })
  kind?: ChangeRequestKind;

  @ApiPropertyOptional({ example: "2026-11-07T19:00:00.000Z" })
  @IsOptional()
  @IsDateString({}, { message: "Nouvelle date de début invalide." })
  new_start_date?: string;

  @ApiPropertyOptional({ example: "2026-11-07T23:00:00.000Z" })
  @IsOptional()
  @IsDateString({}, { message: "Nouvelle date de fin invalide." })
  new_end_date?: string;
}

/** Nouvelle date d'un événement reporté. */
export class RescheduleEventDto {
  @ApiProperty({ example: "2026-11-07T19:00:00.000Z" })
  @IsDateString({}, { message: "Date de début invalide." })
  start_date: string;

  @ApiProperty({ example: "2026-11-07T23:00:00.000Z" })
  @IsDateString({}, { message: "Date de fin invalide." })
  end_date: string;
}
