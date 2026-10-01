import { IsObject } from 'class-validator';

export class UpdateNotificationPrefsDto {
  // Map libre id → booléen : la liste des préférences est définie côté frontend.
  @IsObject()
  preferences: Record<string, boolean>;
}
