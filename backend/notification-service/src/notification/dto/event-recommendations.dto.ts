import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsString, ValidateNested } from 'class-validator';

class RecommendedEventDto {
  @IsString()
  eventId: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  venueName: string;

  @IsString()
  city: string;
}

export class EventRecommendationsDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendedEventDto)
  events: RecommendedEventDto[];
}
