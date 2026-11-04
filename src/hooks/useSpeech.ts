"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 听书：用浏览器自带的语音合成朗读，一段一段读，可以暂停 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const queue = useRef<string[]>([]);
  const stopped = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const next = useCallback(() => {
    const text = queue.current.shift();
    if (!text || stopped.current) {
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1;
    u.onend = () => next();
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      stopped.current = false;
      queue.current = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      setSpeaking(true);
      next();
    },
    [supported, next],
  );

  const stop = useCallback(() => {
    stopped.current = true;
    queue.current = [];
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, speaking, speak, stop };
}
