"use client";

import { useEffect } from "react";
import { detectLang, useLang, useLangStore } from "@/i18n/core";

/**
 * Starts the app in the visitor's language and keeps <html lang> in step.
 * It runs once on the client: the server always renders English, and the
 * loading screen covers the swap.
 */
export function LangSync() {
  const lang = useLang();

  useEffect(() => {
    useLangStore.setState({ lang: detectLang() });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
