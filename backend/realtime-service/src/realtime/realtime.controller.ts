import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RealtimeGateway } from './realtime.gateway';
import { AdminAlertEvent, DashboardChangedEvent, TicketScannedEvent } from './realtime.payloads';

/** Événements publiés dans RabbitMQ (file realtime_queue) par les autres services, relayés aux navigateurs. */
@Controller()
export class RealtimeController {
  constructor(private readonly gateway: RealtimeGateway) {}

  @EventPattern('realtime.ticket_scanned')
  ticketScanned(@Payload() event: TicketScannedEvent): void {
    this.gateway.ticketScanned(event);
  }

  @EventPattern('realtime.dashboard_changed')
  dashboardChanged(@Payload() event: DashboardChangedEvent): void {
    this.gateway.dashboardChanged(event);
  }

  @EventPattern('realtime.admin_alert')
  adminAlert(@Payload() event: AdminAlertEvent): void {
    this.gateway.adminAlert(event);
  }
}
