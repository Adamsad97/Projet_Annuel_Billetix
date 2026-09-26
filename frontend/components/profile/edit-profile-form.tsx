"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { profileUser } from "@/lib/mock/profile";

const fieldClassName =
  "rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none";

export function EditProfileForm() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [firstName, lastName] = profileUser.name.split(" ");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
      className="rounded-2xl border border-hairline-1 bg-card p-6"
    >
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
          {profileUser.initials}
        </div>
        <button
          type="button"
          className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          Changer la photo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">Prénom</span>
          <input type="text" defaultValue={firstName} className={fieldClassName} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">Nom</span>
          <input type="text" defaultValue={lastName} className={fieldClassName} />
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">Email</span>
        <input type="email" defaultValue={profileUser.email} className={fieldClassName} />
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">Téléphone</span>
        <input type="tel" placeholder="06 12 34 56 78" className={fieldClassName} />
      </label>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="flex-1 rounded-full bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
        >
          {saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/profil")}
          className="flex-1 rounded-full border border-hairline-3 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
