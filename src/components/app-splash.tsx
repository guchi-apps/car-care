"use client";

import { useEffect } from "react";

import { AppMark } from "@/components/app-mark";

/*
  PWA（ホーム画面のアイコン）から起動したときだけ出る、起動中のローディング画面。

  - 表示の可否は CSS の display-mode で決める（globals.css）。ブラウザのタブで開いた
    ときには出ない
  - マークアップは最初の HTML に含まれるので、アプリのコードが読み込まれる前から見える
  - 消すのは <html data-app-ready> を立てるだけ。JS が動かなかった場合に備えて、
    globals.css 側に一定時間で必ず消える保険を入れてある
*/

// 一瞬だけちらつくのを防ぐため、この時間は消さずに出しておく
const MIN_VISIBLE_MS = 450;

export function AppSplash() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.documentElement.dataset.appReady = "1";
    }, MIN_VISIBLE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      id="app-splash"
      className="app-brand-surface"
      role="status"
      aria-label="起動しています"
    >
      <div className="app-splash-inner">
        <AppMark idPrefix="splash" className="app-splash-mark" />
        <p className="app-splash-name">CAR CARE</p>
        <span className="app-splash-bar" />
      </div>
    </div>
  );
}
