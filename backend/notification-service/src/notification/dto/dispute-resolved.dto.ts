import { IsEmail, IsOptional, IsString } from 'class-validator';

export class DisputeResolvedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  orderReference: string;

  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  resolutionNotes?: string | null;
}
