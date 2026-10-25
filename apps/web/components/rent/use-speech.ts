"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The slice of the Web Speech API used here (not in lib.dom). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type Ctor = new () => Recognition;

const LANG = { mr: "mr-IN", hi: "hi-IN", en: "en-IN" } as const;

/** Voice input where the browser has it (UI-SPEC §4.4). `supported` is false on the server and first paint. */
export function useSpeech(locale: keyof typeof LANG, onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  const toggle = useCallback(() => {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    r.lang = LANG[locale];
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (text) cb.current(text.trim());
    };
    const done = () => {
      rec.current = null;
      setListening(false);
    };
    r.onend = done;
    r.onerror = done;
    rec.current = r;
    setListening(true);
    r.start();
  }, [locale]);

  useEffect(
    () => () => {
      rec.current?.stop();
    },
    [],
  );

  return { supported, listening, toggle };
}
