import { IsEmail, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class FillThresholdReachedDto {
  @IsEmail()
  @IsOptional()
  email: string | null;

  @IsString()
  @IsOptional()
  firstName: string | null;

  // Lien direct vers l'événement dans l'espace organisateur.
  @IsUUID()
  @IsOptional()
  event_id?: string;

  @IsString()
  event_name: string;

  @IsInt()
  threshold: number;

  @IsInt()
  sold_count: number;

  @IsInt()
  total_capacity: number;
}
