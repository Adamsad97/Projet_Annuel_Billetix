export interface TicketItemDto {
  order_item_id: string;
  ticket_category_id: string;
  ticket_category_name: string;
  unit_price_ttc: number;
  quantity: number;
  holder_first_name: string;
  holder_last_name: string;
  seat_info?: string;
}

export interface GenerateTicketsDto {
  order_id: string;
  buyer_id: string;
  buyer_email: string;

  // Infos événement
  event_id: string;
  event_name: string;
  event_start_at: string; // ISO 8601
  event_end_at?: string;
  event_venue_name: string;
  event_venue_address: string;
  event_city: string;
  event_poster_url?: string;

  // Infos artiste
  artist_name: string;
  artist_description?: string;

  items: TicketItemDto[];
}
