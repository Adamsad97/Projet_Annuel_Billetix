import { IsEmail, IsString } from 'class-validator';

export class KycApprovedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;
}
