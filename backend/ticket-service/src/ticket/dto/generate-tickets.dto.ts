export interface TicketItemDto {
  order_item_id: string;
  ticket_category_id: string;
  quantity: number;
  holder_first_name: string;
  holder_last_name: string;
}

export interface GenerateTicketsDto {
  order_id: string;
  event_id: string;
  buyer_id: string;
  items: TicketItemDto[];
}
