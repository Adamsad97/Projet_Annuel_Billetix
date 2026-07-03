import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateOrganizerProfileDto } from './dto/create-organizer-profile.dto';
import { UpdateBuyerProfileDto } from './dto/update-buyer-profile.dto';
import { UpdateIbanDto } from './dto/update-iban.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  // --- Profil acheteur ---

  @Get('buyer/profile')
  @ApiOperation({ summary: 'Récupérer son profil acheteur' })
  getBuyerProfile(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send('user.get_buyer_profile', { user_id: user.sub }),
    );
  }

  @Patch('buyer/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mettre à jour son profil acheteur (adresse de facturation)' })
  updateBuyerProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBuyerProfileDto) {
    return firstValueFrom(
      this.userClient.send('user.update_buyer_profile', { user_id: user.sub, dto }),
    );
  }

  // --- Profil organisateur ---

  @Post('organizer/profile')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Créer son profil organisateur (réservé ORGANIZER)' })
  createOrganizerProfile(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrganizerProfileDto) {
    return firstValueFrom(
      this.userClient.send('user.create_organizer_profile', { user_id: user.sub, dto }),
    );
  }

  @Get('organizer/profile')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Récupérer son profil organisateur' })
  getOrganizerProfile(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.userClient.send('user.get_organizer_profile', { user_id: user.sub }),
    );
  }

  @Patch('organizer/profile')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Mettre à jour son profil organisateur' })
  updateOrganizerProfile(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrganizerProfileDto) {
    return firstValueFrom(
      this.userClient.send('user.update_organizer_profile', { user_id: user.sub, dto }),
    );
  }

  @Patch('organizer/iban')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Enregistrer ou mettre à jour l\'IBAN (chiffré AES-256)' })
  updateIban(@CurrentUser() user: JwtPayload, @Body() dto: UpdateIbanDto) {
    return firstValueFrom(
      this.userClient.send('user.update_iban', { user_id: user.sub, dto }),
    );
  }
}
