import { IsObject } from 'class-validator';

export class UpdateNotificationPrefsDto {
  // Map libre id -> booléen : la liste des préférences vit côté frontend
  // (lib/mock/notification-prefs.ts), le backend se contente de persister
  // ce qu'on lui envoie sans connaître les ids à l'avance.
  @IsObject()
  preferences: Record<string, boolean>;
}
