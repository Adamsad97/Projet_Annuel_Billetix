import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventController {
  constructor(
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
  ) {}

  // --- Routes publiques ---

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste des événements publiés' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'page', required: false })
  listPublished(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('page') page?: number,
  ) {
    return firstValueFrom(this.eventClient.send('event.list_published', { category, city, page }));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un événement' })
  getById(@Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.get', { id }));
  }

  @Public()
  @Get(':id/categories')
  @ApiOperation({ summary: 'Catégories de billets d\'un événement' })
  getCategories(@Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.get_categories', { event_id: id }));
  }

  // --- Routes organisateur ---

  @Post()
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Créer un événement (ORGANIZER)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.create', { organizer_id: user.sub, dto }));
  }

  @Get('me/events')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Mes événements (ORGANIZER)' })
  myEvents(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(this.eventClient.send('event.list_by_organizer', { organizer_id: user.sub }));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Modifier un événement brouillon (ORGANIZER)' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.update', { id, organizer_id: user.sub, dto }));
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Soumettre un événement à la validation (ORGANIZER)' })
  submit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.submit_for_validation', { id, organizer_id: user.sub }));
  }

  @Post(':id/categories')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Ajouter une catégorie de billet (ORGANIZER)' })
  createCategory(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.create_category', { event_id: id, ...dto }));
  }

  @Post(':id/promo-codes')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Créer un code promo (ORGANIZER)' })
  createPromoCode(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.create_promo_code', { event_id: id, ...dto }));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Annuler son événement (ORGANIZER)' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(this.eventClient.send('event.cancel', { id, actor_id: user.sub, dto }));
  }

  // --- Routes admin ---

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Valider un événement (ADMIN)' })
  validate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.validate', { id, admin_id: user.sub }));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rejeter un événement (ADMIN)' })
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(this.eventClient.send('event.reject', { id, admin_id: user.sub, dto }));
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Suspendre un événement (ADMIN)' })
  suspend(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(this.eventClient.send('event.suspend', { id, admin_id: user.sub, dto }));
  }

  @Post(':id/request-info')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Demander des informations complémentaires (ADMIN)' })
  requestInfo(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { message: string }) {
    return firstValueFrom(
      this.eventClient.send('event.request_info', { event_id: id, admin_id: user.sub, message: dto.message }),
    );
  }
}
