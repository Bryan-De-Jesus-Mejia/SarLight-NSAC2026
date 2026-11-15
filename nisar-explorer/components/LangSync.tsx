"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { detectLang, useLang, useLangStore } from "@/i18n/core";

/**
 * Starts the app in the language chosen before (English the first time) and keeps <html lang> in step.
 * It runs once on the client: the server always renders English, and the
 * loading screen covers the swap.
 */
export function LangSync() {
  const lang = useLang();
  const pathname = usePathname();

  // On load, and whenever the address changes: /aula/es/… and /aula/en/… switch language without a reload.
  useEffect(() => {
    useLangStore.setState({ lang: detectLang() });
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
