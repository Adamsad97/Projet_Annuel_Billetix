import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsInt, IsString, ValidateNested } from 'class-validator';

class OrderConfirmedItemDto {
  @IsString()
  categoryName: string;

  @IsInt()
  quantity: number;

  @IsString()
  unitPrice: string;

  @IsString()
  totalPrice: string;
}

export class OrderConfirmedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  orderReference: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  eventVenue: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderConfirmedItemDto)
  items: OrderConfirmedItemDto[];

  @IsString()
  totalTtc: string;
}
