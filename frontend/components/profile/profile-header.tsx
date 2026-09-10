"use client";

// Bug corrigé : affichait une identité factice codée en dur ("Adama Diawara",
// diawaraad97@gmail.com), quel que soit le compte réellement connecté.

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";

const roleLabels: Record<AuthUser["role"], string> = {
  BUYER: "Acheteur",
  ORGANIZER: "Organisateur",
  ADMIN: "Administrateur",
  AGENT: "Agent de contrôle",
};

const roleStyles: Record<AuthUser["role"], string> = {
  BUYER: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30",
  ORGANIZER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  ADMIN: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30",
  AGENT: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
};

function initialsOf(user: AuthUser): string {
  return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
}

export function ProfileHeader() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
  }, []);

  if (user === undefined) {
    return <div className="mb-8 h-16" />;
  }

  if (!user) {
    return (
      <p className="mb-8 text-sm text-gray-500">
        Connecte-toi pour voir ton profil.
      </p>
    );
  }

  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-amber-400 text-xl font-bold text-white">
          {initialsOf(user)}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">
            {user.first_name} {user.last_name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyles[user.role]}`}
            >
              {roleLabels[user.role]}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      <Link
        href="/profil/modifier"
        className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
      >
        ✏️ Modifier
      </Link>
    </div>
  );
}
