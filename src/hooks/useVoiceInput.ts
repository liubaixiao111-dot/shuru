"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 语音输入：用浏览器的语音识别（Safari / 部分安卓浏览器支持）把说的话转成文字。
 * 注意：Chrome 的语音识别依赖境外服务，在国内网络下可能不可用。做成 App 时应换成
 * 国内语音识别服务（如讯飞、阿里云），接口保持不变：start / stop / 回调文字。
 */
export function useVoiceInput(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<any>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!Ctor);
  }, []);

  const start = useCallback(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setError("当前浏览器不支持语音输入，可以用输入法自带的语音键");
      return;
    }
    setError("");
    const r = new Ctor();
    r.lang = "zh-CN";
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (finalText) cb.current(finalText, true);
      else if (interim) cb.current(interim, false);
    };
    r.onerror = (e: any) => {
      setError(e.error === "not-allowed" ? "没有麦克风权限，请在浏览器设置里允许" : "语音识别出错了，请再试一次");
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
