import { IsString, MinLength } from 'class-validator';

export class CreateOrganizerProfileDto {
  @IsString()
  @MinLength(2)
  display_name: string;
}
