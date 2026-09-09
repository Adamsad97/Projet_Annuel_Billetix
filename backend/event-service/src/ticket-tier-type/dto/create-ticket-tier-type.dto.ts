import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTicketTierTypeDto {
  @IsString() @MinLength(2) @MaxLength(60)
  label: string;

  @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;
}
