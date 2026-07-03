import { IsOptional, IsString } from 'class-validator';

export class AdminActionDto {
  @IsString() @IsOptional()
  reason?: string;
}
