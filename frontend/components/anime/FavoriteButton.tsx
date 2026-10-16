"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { apiDelete, apiGet, apiPost, errorMessage } from "@/lib/api";
import type { FavoriteRef } from "@/lib/types";

export function FavoriteButton({ contentId, contentUrl }: { contentId: string; contentUrl: string | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavorited(false);
      return;
    }
    let active = true;
    apiGet<FavoriteRef[]>("/api/me/favorites")
      .then((items) => {
        if (active) {
          // contentId sudah membawa prefix sumber ("otakudesu:…"), jadi cukup dibandingkan apa adanya.
          setFavorited(items.some((item) => item.contentId === contentId));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, contentId]);

  const toggle = async () => {
    if (!user) {
      toast("Masuk dulu untuk menyimpan ke favorit.", "info");
      return;
    }
    setBusy(true);
    try {
      if (favorited) {
        await apiDelete(`/api/me/favorites/${encodeURIComponent(contentId)}`);
        setFavorited(false);
        toast("Dihapus dari favorit.", "success");
      } else {
        await apiPost("/api/me/favorites", { contentId, contentUrl });
        setFavorited(true);
        toast("Ditambahkan ke favorit.", "success");
      }
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`btn ${favorited ? "btn-danger" : "btn-outline"}`}
      aria-pressed={favorited}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={favorited ? "currentColor" : "none"} aria-hidden>
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.2C1.3 7.6 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.7 3.1 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      {favorited ? "Tersimpan" : "Favorit"}
    </button>
  );
}
