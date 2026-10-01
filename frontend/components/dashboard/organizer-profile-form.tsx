"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  createOrganizerProfile,
  updateOrganizerProfile,
  type ApiOrganizerProfile,
  type OrganizerProfileUpdate,
} from "@/lib/api/organizer-profile";
import { uploadAvatar } from "@/lib/api/upload";
import { ApiError } from "@/lib/api/http-error";
import { isPersistentSession, saveSession } from "@/lib/auth/session";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t, msg } from "@/lib/i18n/translate";

const fieldClassName = fieldClass("px-4 py-3");

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LOGO_MAX_SIZE = 5 * 1024 * 1024; // aligné sur la passerelle (POST /upload/avatar)

const SOCIAL_FIELDS = [
  { key: "social_instagram", label: msg("Instagram"), placeholder: msg("https://instagram.com/votre-compte") },
  { key: "social_facebook", label: "Facebook", placeholder: msg("https://facebook.com/votre-page") },
  { key: "social_twitter", label: "X (Twitter)", placeholder: msg("https://x.com/votre-compte") },
  { key: "social_youtube", label: "YouTube", placeholder: msg("https://youtube.com/@votre-chaine") },
] as const;

type SocialKey = (typeof SOCIAL_FIELDS)[number]["key"];

/** Adresse web complétée si l'organisateur a omis « https:// ». */
function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Profil public : création (un acheteur devient organisateur) ou modification. */
export function OrganizerProfileForm({
  profile,
  onSaved,
  submitLabel,
}: {
  profile: ApiOrganizerProfile | null;
  onSaved: (profile: ApiOrganizerProfile) => void;
  submitLabel?: string;
}) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [website, setWebsite] = useState(profile?.website_url ?? "");
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    social_instagram: profile?.social_instagram ?? "",
    social_facebook: profile?.social_facebook ?? "",
    social_twitter: profile?.social_twitter ?? "",
    social_youtube: profile?.social_youtube ?? "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setError(t("Logo : format non supporté — JPEG, PNG ou WebP uniquement."));
      return;
    }
    if (file.size > LOGO_MAX_SIZE) {
      setError(t("Logo : fichier trop volumineux — 5 Mo maximum."));
      return;
    }
    setError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const name = displayName.trim();
    if (name.length < 2) {
      setError(t("Le nom public doit contenir au moins 2 caractères."));
      return;
    }

    setSaving(true);
    try {
      const finalLogo = logoFile ? (await uploadAvatar(logoFile)).url : logoUrl;
      const fields: OrganizerProfileUpdate = {
        display_name: name,
        description: description.trim() || null,
        logo_url: finalLogo || null,
        website_url: normalizeUrl(website) || null,
        ...Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, normalizeUrl(socials[key]) || null])),
      };

      let result: ApiOrganizerProfile;
      if (profile) {
        result = await updateOrganizerProfile(fields);
      } else {
        const created = await createOrganizerProfile({
          display_name: name,
          description: fields.description ?? undefined,
          logo_url: fields.logo_url ?? undefined,
          website_url: fields.website_url ?? undefined,
        });
        // Acheteur devenu organisateur : nouveaux jetons avec le rôle à jour.
        if (created.access_token && created.refresh_token && created.user) {
          saveSession(
            { access_token: created.access_token, refresh_token: created.refresh_token, user: created.user },
            isPersistentSession(),
          );
        }
        const socialValues = SOCIAL_FIELDS.map(({ key }) => fields[key]).filter(Boolean);
        result =
          socialValues.length > 0
            ? await updateOrganizerProfile(
                Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, fields[key]])) as OrganizerProfileUpdate,
              )
            : created.profile;
      }

      // Valeurs telles qu'enregistrées (adresses complétées en https://).
      setDisplayName(result.display_name);
      setDescription(result.description ?? "");
      setWebsite(result.website_url ?? "");
      setSocials({
        social_instagram: result.social_instagram ?? "",
        social_facebook: result.social_facebook ?? "",
        social_twitter: result.social_twitter ?? "",
        social_youtube: result.social_youtube ?? "",
      });
      setLogoFile(null);
      setLogoUrl(result.logo_url);
      setLogoPreview(result.logo_url);
      setSaved(true);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("L'enregistrement a échoué, veuillez réessayer."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass("flex flex-col gap-6 p-6")}>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-hairline-2 ring-1 ring-inset ring-hairline-2">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo hébergé sur MinIO ou aperçu local (blob:)
            <img src={logoPreview} alt={t("Logo de l'organisateur")} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-ink-4">{displayName.trim().charAt(0).toUpperCase() || "?"}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink-1">{t("Logo")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className={buttonClass("secondary", "rounded-full px-4 py-1.5 text-xs")}
            >
              {logoPreview ? t("Changer") : t("Ajouter un logo")}
            </button>
            {logoPreview ? (
              <button
                type="button"
                onClick={removeLogo}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-4 transition-colors hover:text-ink-1"
              >{t("Retirer")}</button>
            ) : null}
          </div>
          <p className="text-xs text-ink-5">{t("JPEG, PNG ou WebP — 5 Mo max. Un format carré rend mieux.")}</p>
        </div>
        <input
          ref={logoInput}
          type="file"
          accept={LOGO_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            pickLogo(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Nom public *")}</span>
        <input
          type="text"
          required
          minLength={2}
          maxLength={120}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={t("Ex : Les Nuits de Paris")}
          className={fieldClassName}
        />
        <span className="text-xs text-ink-5">{t("Nom sous lequel vos événements sont présentés au public.")}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Présentation")}</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("Qui êtes-vous, quels événements organisez-vous ?")}
          className={`${fieldClassName} resize-none`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Site web")}</span>
        <input
          type="text"
          inputMode="url"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder={t("https://www.votre-site.fr")}
          className={fieldClassName}
        />
      </label>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink-2">{t("Réseaux sociaux")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{label}</span>
              <input
                type="text"
                inputMode="url"
                value={socials[key]}
                onChange={(event) => setSocials((prev) => ({ ...prev, [key]: event.target.value }))}
                placeholder={t(placeholder)}
                className={fieldClassName}
              />
            </label>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-danger ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      ) : null}
      {saved && profile ? (
        <p role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-success ring-1 ring-inset ring-emerald-500/30">{t("Profil enregistré.")}</p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className={buttonClass("primary", "self-end rounded-full px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50")}
      >
        {saving ? t("Enregistrement…") : submitLabel ?? (profile ? t("Enregistrer") : t("Créer mon profil organisateur"))}
      </button>
    </form>
  );
}
