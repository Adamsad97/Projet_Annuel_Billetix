"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { profileUser } from "@/lib/mock/profile";

const fieldClassName =
  "rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none";

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
      className="rounded-2xl border border-white/5 bg-[#12101c] p-6"
    >
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-amber-400 text-lg font-bold text-white">
          {profileUser.initials}
        </div>
        <button
          type="button"
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
        >
          Changer la photo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">Prénom</span>
          <input type="text" defaultValue={firstName} className={fieldClassName} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">Nom</span>
          <input type="text" defaultValue={lastName} className={fieldClassName} />
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-violet-200/80">Email</span>
        <input type="email" defaultValue={profileUser.email} className={fieldClassName} />
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-violet-200/80">Téléphone</span>
        <input type="tel" placeholder="06 12 34 56 78" className={fieldClassName} />
      </label>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
        >
          {saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/profil")}
          className="flex-1 rounded-full border border-white/15 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
