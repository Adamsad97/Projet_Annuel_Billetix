import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Alerte à un admin : une action l'attend dans l'espace d'administration. */
export class AdminNoticeDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  @MaxLength(200)
  headline: string;

  @IsString()
  @MaxLength(1000)
  intro: string;

  /** Lignes de détail (nom, email, date…). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  details?: string[];

  @IsString()
  @MaxLength(60)
  ctaLabel: string;

  /** Page de l'espace d'administration à ouvrir. */
  @Matches(/^\/admin(\/[\w\-/]*)?$/, { message: 'ctaPath doit désigner une page /admin' })
  ctaPath: string;
}
