/*
  アプリアイコンと同じ絵柄をインライン SVG で描く。ログイン画面と起動画面で使う。
  形と色の原本は scripts/icon.template.svg で、こちらはその写し。
  片方だけ直すとアイコンと画面がずれるので、変えるときは両方を直す。

  グラデーションの id は 1 ページに 2 つ置いても衝突しないよう idPrefix で分ける
  （useId はサーバーコンポーネントで使えないため、呼び出し側が固定の文字列を渡す）。
*/
type AppMarkProps = {
  idPrefix: string;
  className?: string;
};

export function AppMark({ idPrefix, className }: AppMarkProps) {
  const bg = `${idPrefix}-bg`;
  const glow = `${idPrefix}-glow`;
  const glass = `${idPrefix}-glass`;
  const lamp = `${idPrefix}-lamp`;

  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d72ea" />
          <stop offset="0.55" stopColor="#2050c8" />
          <stop offset="1" stopColor="#0f2f83" />
        </linearGradient>
        <radialGradient id={glow} cx="0.24" cy="0.15" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c48b8" />
          <stop offset="1" stopColor="#12327f" />
        </linearGradient>
        <linearGradient id={lamp} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />
      <rect width="512" height="512" rx="116" fill={`url(#${glow})`} />

      <g transform="translate(0,-15)">
        <rect x="126" y="360" width="70" height="30" rx="15" fill="#0d2666" />
        <rect x="316" y="360" width="70" height="30" rx="15" fill="#0d2666" />
        <path
          d="M158 250 L184 176 C189 161 201 152 216 152 H296 C311 152 323 161 328 176 L354 250 Z"
          fill="#ffffff"
        />
        <rect x="96" y="242" width="320" height="126" rx="42" fill="#ffffff" />
        <path
          d="M184 246 L205 186 C208 178 214 174 222 174 H290 C298 174 304 178 307 186 L328 246 Z"
          fill={`url(#${glass})`}
        />
        <rect x="124" y="278" width="76" height="30" rx="15" fill={`url(#${lamp})`} />
        <rect x="312" y="278" width="76" height="30" rx="15" fill={`url(#${lamp})`} />
        <rect
          x="214"
          y="330"
          width="84"
          height="18"
          rx="9"
          fill="#12327f"
          fillOpacity="0.32"
        />
      </g>
    </svg>
  );
}
