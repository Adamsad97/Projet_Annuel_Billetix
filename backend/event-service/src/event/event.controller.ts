import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EventService } from './event.service';
import { RescheduleEventPayload } from '../common/module-payloads';
import { AdminActionPayload, AdminIdPayload, IdPayload, IdsPayload, OrganizerPayload, OwnedIdPayload, SlugPayload } from '../common/payloads';
import { CancelEventPayload, CreateEventPayload, ListAllEventsPayload, ListPublishedPayload, RecommendationPayload, RequestInfoPayload, RespondToInfoPayload, UpdateEventPayload, VerifyNonProfitPayload, CountInPeriodsPayload } from './dto/event-payloads';

@Controller()
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @MessagePattern('event.create')
  create(@Payload() data: CreateEventPayload) {
    return this.eventService.create(data.organizer_id, data.dto);
  }

  @MessagePattern('event.get')
  getById(@Payload() data: IdPayload) {
    return this.eventService.getById(data.id);
  }

  @MessagePattern('event.get_public')
  getPublic(@Payload() data: IdPayload) {
    return this.eventService.getPublic(data.id);
  }

  @MessagePattern('event.get_by_slug')
  getBySlug(@Payload() data: SlugPayload) {
    return this.eventService.getBySlug(data.slug);
  }

  @MessagePattern('event.get_by_ids')
  getByIds(@Payload() data: IdsPayload) {
    return this.eventService.getByIds(data.ids);
  }

  @MessagePattern('event.list_published')
  listPublished(@Payload() filters: ListPublishedPayload) {
    return this.eventService.listPublished(filters);
  }

  @MessagePattern('event.count_by_category')
  countByCategory() {
    return this.eventService.countUpcomingByCategory();
  }

  @MessagePattern('event.count_in_periods')
  countInPeriods(@Payload() data: CountInPeriodsPayload) {
    return this.eventService.countInPeriods(data.periods);
  }

  @MessagePattern('event.list_for_recommendation')
  listForRecommendation(
    @Payload() data: RecommendationPayload,
  ) {
    return this.eventService.listForRecommendation(data.category, data.exclude_event_ids, data.limit);
  }

  @MessagePattern('event.list_pending')
  listPending() {
    return this.eventService.listPending();
  }

  @MessagePattern('event.list_by_organizer')
  listByOrganizer(@Payload() data: OrganizerPayload) {
    return this.eventService.listByOrganizer(data.organizer_id);
  }

  @MessagePattern('event.list_all')
  listAll(@Payload() data: ListAllEventsPayload) {
    return this.eventService.listAll(data ?? {});
  }

  @MessagePattern('event.get_count_by_status')
  getCountByStatus() {
    return this.eventService.getCountByStatus();
  }

  @MessagePattern('event.update')
  update(@Payload() data: UpdateEventPayload) {
    return this.eventService.update(data.id, data.organizer_id, data.dto);
  }

  @MessagePattern('event.submit_for_validation')
  submitForValidation(@Payload() data: OwnedIdPayload) {
    return this.eventService.submitForValidation(data.id, data.organizer_id);
  }

  @MessagePattern('event.validate')
  validate(@Payload() data: AdminIdPayload) {
    return this.eventService.validate(data.id, data.admin_id);
  }

  @MessagePattern('event.mark_first_sale')
  markFirstSale(@Payload() data: IdPayload) {
    return this.eventService.markFirstSale(data.id);
  }

  @MessagePattern('event.verify_non_profit')
  verifyNonProfit(@Payload() data: VerifyNonProfitPayload) {
    return this.eventService.verifyNonProfit(data.id, data.admin_id, data.approved, data.reason);
  }

  @MessagePattern('event.reject')
  reject(@Payload() data: AdminActionPayload) {
    return this.eventService.reject(data.id, data.admin_id, data.dto);
  }

  @MessagePattern('event.suspend')
  suspend(@Payload() data: AdminActionPayload) {
    return this.eventService.suspend(data.id, data.admin_id, data.dto);
  }

  @MessagePattern('event.unsuspend')
  unsuspend(@Payload() data: IdPayload) {
    return this.eventService.unsuspend(data.id);
  }

  @MessagePattern('event.hide')
  hide(@Payload() data: AdminActionPayload) {
    return this.eventService.hide(data.id, data.admin_id, data.dto);
  }

  @MessagePattern('event.unhide')
  unhide(@Payload() data: IdPayload) {
    return this.eventService.unhide(data.id);
  }

  @MessagePattern('event.cancel')
  cancel(@Payload() data: CancelEventPayload) {
    return this.eventService.cancel(data.id, data.actor_id, data.dto, data.is_admin ?? false);
  }

  @MessagePattern('event.request_info')
  requestInfo(@Payload() data: RequestInfoPayload) {
    return this.eventService.requestInfo(data.id, data.admin_id, data.message);
  }

  @MessagePattern('event.respond_to_info_request')
  respondToInfoRequest(@Payload() data: RespondToInfoPayload) {
    return this.eventService.respondToInfoRequest(data.request_id, data.organizer_id, data.response);
  }

  @MessagePattern('event.reschedule')
  reschedule(@Payload() data: RescheduleEventPayload) {
    return this.eventService.reschedule(data.id, data.organizer_id, data.start_date, data.end_date);
  }

  @MessagePattern('event.duplicate')
  duplicate(@Payload() data: OwnedIdPayload) {
    return this.eventService.duplicate(data.id, data.organizer_id);
  }
}
