import { useCallback, useEffect, useRef, useState } from "react";

// Thin wrapper over the browser's Web Speech API (SpeechRecognition). On-device /
// browser-provided transcription — no server, no API cost. Supported in Chrome,
// Edge and Safari (webkit-prefixed); `supported` is false elsewhere so callers
// can hide the mic button. Requires HTTPS (or localhost) + mic permission.
/* eslint-disable @typescript-eslint/no-explicit-any */

type StartOptions = {
  lang?: string;
  // Fires on every partial result with the full text so far (for a live preview).
  onInterim?: (text: string) => void;
  // Fires once with the complete transcript when recognition ends naturally or
  // via stop() — but NOT when cancelled via abort().
  onFinal?: (text: string) => void;
};

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeechToText() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const cancelledRef = useRef(false);
  const optsRef = useRef<StartOptions>({});

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const start = useCallback((opts: StartOptions = {}) => {
    const SR = getSR();
    if (!SR) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    try {
      recRef.current?.abort();
    } catch {
      /* no active session */
    }
    optsRef.current = opts;
    finalRef.current = "";
    cancelledRef.current = false;
    setError(null);

    const rec = new SR();
    rec.lang = opts.lang || "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      optsRef.current.onInterim?.((finalRef.current + interim).replace(/\s+/g, " ").trim());
    };
    rec.onerror = (e: any) => {
      setError(
        e?.error === "not-allowed" || e?.error === "service-not-allowed"
          ? "Microphone access was blocked — allow it in your browser settings."
          : e?.error === "no-speech"
            ? "Didn't catch that — try again."
            : "Voice input error. Please try again.",
      );
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.replace(/\s+/g, " ").trim();
      if (!cancelledRef.current && text) optsRef.current.onFinal?.(text);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start() throws if called while already starting — ignore */
    }
  }, []);

  // Finish and deliver the transcript (fires onFinal via onend).
  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* nothing listening */
    }
  }, []);

  // Cancel without delivering a transcript.
  const abort = useCallback(() => {
    cancelledRef.current = true;
    try {
      recRef.current?.abort();
    } catch {
      /* nothing listening */
    }
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* unmount cleanup */
      }
    },
    [],
  );

  return { supported, listening, error, start, stop, abort };
}
