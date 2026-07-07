import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class FillThresholdReachedDto {
  @IsEmail()
  @IsOptional()
  email: string | null;

  @IsString()
  @IsOptional()
  firstName: string | null;

  @IsString()
  event_name: string;

  @IsInt()
  threshold: number;

  @IsInt()
  sold_count: number;

  @IsInt()
  total_capacity: number;
}
