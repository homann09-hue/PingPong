/* Aurora Slot-Symbole - 70 themenspezifische Symbole (7 je Slot)
   auf einem gemeinsamen Material-System. Alle SVG-Fragmente sind statisch
   und selbst verfasst: kein Fremdinhalt, keine Nutzereingabe. */

export type SymbolCode = "A" | "K" | "Q" | "J" | "W" | "S" | "B";

const G = [
  '<defs>',
  '<linearGradient id="agold" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fff8d0"/><stop offset=".2" stop-color="#ffdd82"/><stop offset=".45" stop-color="#e8a72c"/><stop offset=".62" stop-color="#a86a10"/><stop offset=".8" stop-color="#f0c250"/><stop offset="1" stop-color="#7a4808"/></linearGradient>',
  '<linearGradient id="ared" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffd0cf"/><stop offset=".14" stop-color="#ff6b74"/><stop offset=".44" stop-color="#e01230"/><stop offset=".64" stop-color="#9c0620"/><stop offset=".84" stop-color="#e83048"/><stop offset="1" stop-color="#6d0416"/></linearGradient>',
  '<linearGradient id="acyan" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#eaffff"/><stop offset=".2" stop-color="#7fe6ff"/><stop offset=".5" stop-color="#22a6da"/><stop offset=".72" stop-color="#0a5c85"/><stop offset="1" stop-color="#063a55"/></linearGradient>',
  '<linearGradient id="agreen" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e6ffee"/><stop offset=".2" stop-color="#6ff2a4"/><stop offset=".5" stop-color="#1cb264"/><stop offset=".74" stop-color="#0a6636"/><stop offset="1" stop-color="#05421f"/></linearGradient>',
  '<linearGradient id="apurple" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#f6e6ff"/><stop offset=".2" stop-color="#cf9bff"/><stop offset=".5" stop-color="#8a3ee0"/><stop offset=".74" stop-color="#4a1490"/><stop offset="1" stop-color="#2b0a58"/></linearGradient>',
  '<linearGradient id="apink" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffe8f6"/><stop offset=".2" stop-color="#ff9ad8"/><stop offset=".5" stop-color="#f0439f"/><stop offset=".74" stop-color="#a3126a"/><stop offset="1" stop-color="#5e0740"/></linearGradient>',
  '<linearGradient id="awood" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e0b58a"/><stop offset=".3" stop-color="#a9713d"/><stop offset=".7" stop-color="#6b3f18"/><stop offset="1" stop-color="#40230b"/></linearGradient>',
  '<linearGradient id="asteel" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#cdd8e6"/><stop offset=".55" stop-color="#8595ab"/><stop offset=".78" stop-color="#4d5a6b"/><stop offset="1" stop-color="#2c3542"/></linearGradient>',
  '<linearGradient id="aice" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".22" stop-color="#d6f4ff"/><stop offset=".5" stop-color="#7cc8ee"/><stop offset=".76" stop-color="#3577a8"/><stop offset="1" stop-color="#17415f"/></linearGradient>',
  '<linearGradient id="astone" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e8e2d4"/><stop offset=".3" stop-color="#b3a894"/><stop offset=".7" stop-color="#6f6553"/><stop offset="1" stop-color="#403a2e"/></linearGradient>',
  '<linearGradient id="ateal" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#dffff8"/><stop offset=".25" stop-color="#5fe8d0"/><stop offset=".55" stop-color="#12a48c"/><stop offset="1" stop-color="#064a40"/></linearGradient>',
  '<radialGradient id="ahot" cx=".32" cy=".24" r=".42"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>',
  '<filter id="adrop" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".7"/></filter>',
  '</defs>',
].join("");

const O = 'stroke="#2a1204" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"';
const OC = 'stroke="#0a2a3e" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"';
const hot = (x: number, y: number, rx: number, ry: number, r = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#ahot)" transform="rotate(${r} ${x} ${y})"/>`;

type SymbolSet = Record<SymbolCode, string>;

const SETS: Record<string, SymbolSet> = {
  vegas: {
    A: `<path d="M44 26h112a10 10 0 0 1 10 10v14a10 10 0 0 1-2 6l-58 108a10 10 0 0 1-9 5H60a10 10 0 0 1-9-15l52-96H44a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z" fill="url(#agold)" ${O}/><path d="M52 38h96v10L92 156H68l54-100H52z" fill="url(#ared)" stroke="#4a0210" stroke-width="3"/>${hot(80, 52, 24, 10, -8)}`,
    K: `<rect x="20" y="62" width="160" height="76" rx="14" fill="url(#agold)" ${O}/><rect x="34" y="74" width="132" height="18" rx="9" fill="#fff" opacity=".45"/><rect x="42" y="104" width="116" height="9" rx="4.5" fill="#7a4a08" opacity=".6"/>`,
    Q: `<path d="M100 26a12 12 0 0 1 12 12v3c26 10 34 34 34 57v28l15 22a6 6 0 0 1-5 9H44a6 6 0 0 1-5-9l15-22V98c0-23 8-47 34-57v-3a12 12 0 0 1 12-12z" fill="url(#agold)" ${O}/><ellipse cx="100" cy="166" rx="22" ry="14" fill="url(#agold)" ${O}/>${hot(76, 62, 15, 8, -30)}`,
    J: `<path d="M104 40c-9 9-24 15-28 33" stroke="#1f7a2e" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M104 40c7 11 20 17 29 28" stroke="#1f7a2e" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="62" cy="132" r="30" fill="url(#ared)" ${O}/><circle cx="140" cy="124" r="27" fill="url(#ared)" ${O}/>${hot(52, 120, 10, 6)}`,
    W: `<path d="M100 20 176 78 100 182 24 78z" fill="url(#acyan)" ${O}/><path d="M100 20 176 78H24z" fill="#dffaff" opacity=".75"/><path d="M100 20 62 78l38 104 38-104z" fill="#fff" opacity=".25"/>${hot(80, 52, 17, 8, -24)}`,
    S: `<path d="M100 22c-25 0-40 19-40 43 0 18 5 33 5 43h20c0-13-5-23-5-41 0-15 8-25 20-25s20 10 20 25c0 18-5 28-5 41h20c0-10 5-25 5-43 0-24-15-43-40-43z" fill="url(#agold)" ${O}/><circle cx="72" cy="52" r="4.5" fill="#6b3d05"/><circle cx="128" cy="52" r="4.5" fill="#6b3d05"/>`,
    B: `<circle cx="100" cy="100" r="72" fill="url(#agold)" ${O}/><circle cx="100" cy="100" r="52" fill="none" stroke="#8a5a08" stroke-width="7" opacity=".7"/><path d="M100 62h11l-26 76h-11z" fill="#8a5a08" opacity=".8"/>${hot(74, 68, 22, 12, -30)}`,
  },
  saloon: {
    A: `<path d="M100 18l19 44 48 4-36 32 11 47-42-25-42 25 11-47-36-32 48-4z" fill="url(#agold)" ${O}/><circle cx="100" cy="98" r="17" fill="#7a4808" opacity=".55"/>${hot(78, 58, 17, 9, -25)}`,
    K: `<path d="M30 106h96l24-16 22 6-8 20 14 10-10 16-30-8-18 14H44a14 14 0 0 1-14-14z" fill="url(#asteel)" ${O}/><rect x="44" y="120" width="46" height="14" rx="6" fill="#3a4552" opacity=".7"/><path d="M56 140l-12 30h22l10-26z" fill="url(#awood)" ${O}/>`,
    Q: `<path d="M84 24h32v22l10 14v106a14 14 0 0 1-14 14H88a14 14 0 0 1-14-14V60l10-14z" fill="url(#awood)" ${O}/><rect x="80" y="96" width="40" height="40" rx="5" fill="#f0d9a8" stroke="#2a1204" stroke-width="4"/><path d="M92 30h16v14H92z" fill="#c9a15e"/>${hot(88, 70, 10, 16)}`,
    J: `<path d="M100 22c-25 0-40 19-40 43 0 18 5 33 5 43h20c0-13-5-23-5-41 0-15 8-25 20-25s20 10 20 25c0 18-5 28-5 41h20c0-10 5-25 5-43 0-24-15-43-40-43z" fill="url(#asteel)" ${O}/><circle cx="72" cy="52" r="4.5" fill="#39434f"/><circle cx="128" cy="52" r="4.5" fill="#39434f"/>`,
    W: `<path d="M46 128c-8-4-14-10-14-16 0-10 16-16 28-18 2-30 14-52 40-52s38 22 40 52c12 2 28 8 28 18 0 6-6 12-14 16-14 7-34 10-54 10s-40-3-54-10z" fill="url(#awood)" ${O}/><rect x="58" y="92" width="84" height="16" rx="7" fill="#2a1204" opacity=".75"/>${hot(80, 64, 16, 10, -20)}`,
    S: `<rect x="24" y="72" width="66" height="66" rx="12" fill="#f4f0e6" ${O} transform="rotate(-12 57 105)"/><rect x="110" y="66" width="66" height="66" rx="12" fill="#f4f0e6" ${O} transform="rotate(10 143 99)"/><circle cx="45" cy="94" r="6" fill="#c0122a"/><circle cx="70" cy="118" r="6" fill="#c0122a"/><circle cx="130" cy="86" r="6" fill="#1a1a1a"/><circle cx="156" cy="112" r="6" fill="#1a1a1a"/>`,
    B: `<path d="M64 148c-14-6-24-18-24-32 0-22 26-34 60-34s60 12 60 34c0 14-10 26-24 32-12 5-24 7-36 7s-24-2-36-7z" fill="url(#agold)" ${O}/>${hot(84, 102, 20, 11, -15)}`,
  },
  cosmic: {
    A: `<circle cx="100" cy="100" r="56" fill="url(#apurple)" ${O}/><ellipse cx="100" cy="100" rx="94" ry="26" fill="none" stroke="#ffd76a" stroke-width="10" transform="rotate(-22 100 100)"/>${hot(78, 74, 20, 12, -25)}`,
    K: `<path d="M100 16c22 18 34 44 34 74v40l14 20h-30l-18 26-18-26H52l14-20V90c0-30 12-56 34-74z" fill="url(#asteel)" ${O}/><circle cx="100" cy="82" r="16" fill="url(#acyan)" stroke="#0a3a52" stroke-width="5"/><path d="M74 150l-14 30 24-10z" fill="url(#ared)" stroke="#2a1204" stroke-width="4"/><path d="M126 150l14 30-24-10z" fill="url(#ared)" stroke="#2a1204" stroke-width="4"/>`,
    Q: `<circle cx="126" cy="74" r="34" fill="url(#acyan)" ${O}/><path d="M100 96 22 172c26 4 52-4 70-22 14-14 18-34 8-54z" fill="url(#agold)" ${O}/>${hot(112, 58, 14, 8, -25)}`,
    J: `<path d="M100 16l20 50 54 4-41 36 13 54-46-29-46 29 13-54-41-36 54-4z" fill="url(#acyan)" ${O}/><path d="M100 16l20 50-20 10-20-10z" fill="#fff" opacity=".4"/>`,
    W: `<circle cx="100" cy="100" r="66" fill="#0a0420" ${O}/><circle cx="100" cy="100" r="66" fill="none" stroke="url(#apurple)" stroke-width="14"/><circle cx="100" cy="100" r="30" fill="#1a0836"/><ellipse cx="100" cy="100" rx="88" ry="20" fill="none" stroke="url(#acyan)" stroke-width="7" transform="rotate(30 100 100)" opacity=".9"/>`,
    S: `<path d="M100 22 132 78l62 10-44 44 10 62-60-30-60 30 10-62L6 88l62-10z" fill="url(#agreen)" ${O}/><path d="M100 22 132 78l-32 16-32-16z" fill="#fff" opacity=".35"/>`,
    B: `<rect x="76" y="70" width="48" height="60" rx="8" fill="url(#asteel)" ${O}/><rect x="14" y="84" width="56" height="32" rx="6" fill="url(#acyan)" ${O}/><rect x="130" y="84" width="56" height="32" rx="6" fill="url(#acyan)" ${O}/><circle cx="100" cy="100" r="12" fill="url(#agold)" stroke="#2a1204" stroke-width="4"/>`,
  },
  pharaoh: {
    A: `<path d="M100 24c30 0 46 22 46 52 0 16-4 30-4 44l14 46c2 8-4 12-10 12H54c-6 0-12-4-10-12l14-46c0-14-4-28-4-44 0-30 16-52 46-52z" fill="url(#agold)" ${O}/><path d="M74 78h20v14H74zm32 0h20v14h-20z" fill="#1a3a6e"/><path d="M70 116h60l-8 20H78z" fill="#1a3a6e" opacity=".8"/>${hot(78, 58, 18, 10, -20)}`,
    K: `<path d="M100 20a26 26 0 0 1 26 26 26 26 0 0 1-16 24v14h30v22h-30v72H90v-72H60V90h30V70a26 26 0 0 1-16-24 26 26 0 0 1 26-26z" fill="url(#agold)" ${O}/><circle cx="100" cy="46" r="11" fill="#2a1204" opacity=".55"/>${hot(84, 38, 14, 8, -25)}`,
    Q: `<ellipse cx="100" cy="108" rx="62" ry="52" fill="url(#ateal)" ${O}/><path d="M100 56c16 0 26 12 26 26H74c0-14 10-26 26-26z" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/><path d="M100 60v96M62 100h76" stroke="#083f38" stroke-width="6"/>${hot(78, 86, 18, 10, -25)}`,
    J: `<path d="M100 26 176 168H24z" fill="url(#agold)" ${O}/><path d="M100 26 62 168h76z" fill="#fff" opacity=".18"/><path d="M100 26 24 168h34L100 60z" fill="#000" opacity=".18"/>${hot(88, 72, 16, 9, -30)}`,
    W: `<path d="M100 62c40 0 72 26 88 38-16 12-48 38-88 38s-72-26-88-38c16-12 48-38 88-38z" fill="#f4e3b8" ${O}/><circle cx="100" cy="100" r="30" fill="url(#acyan)" stroke="#2a1204" stroke-width="5"/><circle cx="100" cy="100" r="13" fill="#0a1a2e"/><path d="M60 142l-16 34M140 142l16 34" stroke="#2a1204" stroke-width="9"/>`,
    S: `<circle cx="100" cy="100" r="52" fill="url(#agold)" ${O}/><g stroke="url(#agold)" stroke-width="11" stroke-linecap="round"><path d="M100 22v-12M100 190v-12M22 100H10M190 100h-12M45 45l-9-9M164 164l9 9M45 155l-9 9M164 36l9-9"/></g>${hot(80, 78, 18, 10, -30)}`,
    B: `<path d="M100 18c26 0 44 16 44 40v96c0 16-18 28-44 28s-44-12-44-28V58c0-24 18-40 44-40z" fill="url(#agold)" ${O}/><ellipse cx="100" cy="70" rx="24" ry="26" fill="#1a3a6e" opacity=".85"/><path d="M74 120h52v10H74zm0 22h52v10H74z" fill="#1a3a6e" opacity=".7"/>`,
  },
  dragon: {
    A: `<path d="M56 150c-16-14-26-32-26-52 0-40 32-72 70-72 26 0 42 12 52 26-14-4-30-2-42 8 18 2 32 14 38 30-16-10-36-8-48 4 12 26 4 50-14 62-10 6-22 4-30-6z" fill="url(#ared)" ${O}/><circle cx="78" cy="82" r="10" fill="#ffd76a" stroke="#2a1204" stroke-width="4"/><path d="M50 148l-18 26 34-8z" fill="url(#agold)" stroke="#2a1204" stroke-width="4"/>`,
    K: `<circle cx="100" cy="106" r="54" fill="url(#ared)" ${O}/><path d="M100 52c-14 20-22 34-22 48a22 22 0 0 0 44 0c0-14-8-28-22-48z" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/>${hot(78, 80, 18, 10, -25)}`,
    Q: `<path d="M100 14l16 42 34-18-14 38 42 8-34 26 26 32-42-8 4 42-32-28-32 28 4-42-42 8 26-32-34-26 42-8-14-38 34 18z" fill="url(#agold)" ${O}/>${hot(84, 60, 18, 10, -25)}`,
    J: `<path d="M100 20l64 26v56c0 40-28 68-64 82-36-14-64-42-64-82V46z" fill="url(#asteel)" ${O}/><path d="M100 44l40 16v40c0 26-18 44-40 54-22-10-40-28-40-54V60z" fill="url(#ared)" stroke="#2a1204" stroke-width="5"/>${hot(80, 60, 16, 9, -25)}`,
    W: `<ellipse cx="100" cy="100" rx="84" ry="52" fill="#f2e6c8" ${O}/><ellipse cx="100" cy="100" rx="32" ry="46" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/><ellipse cx="100" cy="100" rx="13" ry="34" fill="#1a0a04"/>`,
    S: `<path d="M100 22c22 30 40 52 40 76a40 40 0 0 1-80 0c0-24 18-46 40-76z" fill="url(#ared)" ${O}/><path d="M100 84c10 14 18 24 18 34a18 18 0 0 1-36 0c0-10 8-20 18-34z" fill="url(#agold)" stroke="#2a1204" stroke-width="4"/>`,
    B: `<path d="M32 92h136a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10v-56a10 10 0 0 1 10-10z" fill="url(#awood)" ${O}/><path d="M32 92c0-26 30-44 68-44s68 18 68 44z" fill="url(#agold)" ${O}/><rect x="84" y="112" width="32" height="34" rx="6" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/>`,
  },
  candy: {
    A: `<circle cx="100" cy="82" r="56" fill="url(#apink)" ${O}/><path d="M100 26a56 56 0 0 1 56 56" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".85"/><rect x="92" y="132" width="16" height="56" rx="8" fill="#f4f0e6" stroke="#2a1204" stroke-width="5"/>${hot(76, 58, 18, 10, -25)}`,
    K: `<path d="M46 108h108l-10 66a12 12 0 0 1-12 10H68a12 12 0 0 1-12-10z" fill="#f4d9a8" ${O}/><path d="M40 108c0-30 26-52 60-52s60 22 60 52z" fill="url(#apink)" ${O}/><circle cx="100" cy="46" r="14" fill="url(#ared)" stroke="#2a1204" stroke-width="5"/>`,
    Q: `<path d="M118 24c22 0 38 16 38 36 0 34-46 62-46 116-30-14-46-46-46-76 0-40 24-76 54-76z" fill="url(#ared)" ${O}/><path d="M104 44c14 10 20 24 18 40-16-6-28-20-30-36z" fill="#fff" opacity=".45"/>`,
    J: `<circle cx="100" cy="100" r="58" fill="url(#apurple)" ${O}/><circle cx="100" cy="100" r="34" fill="url(#agreen)" stroke="#2a1204" stroke-width="5"/><circle cx="100" cy="100" r="14" fill="#fff8d0"/>${hot(78, 74, 20, 11, -25)}`,
    W: `<path d="M20 150c0-56 36-100 80-100s80 44 80 100" fill="none" stroke="url(#ared)" stroke-width="22"/><path d="M44 150c0-42 26-74 56-74s56 32 56 74" fill="none" stroke="url(#agold)" stroke-width="20"/><path d="M68 150c0-28 14-48 32-48s32 20 32 48" fill="none" stroke="url(#acyan)" stroke-width="18"/>`,
    S: `<path d="M100 18l22 48 52 6-38 36 10 52-46-26-46 26 10-52-38-36 52-6z" fill="url(#agold)" ${O}/><circle cx="100" cy="96" r="18" fill="url(#apink)" stroke="#2a1204" stroke-width="5"/>`,
    B: `<rect x="26" y="82" width="148" height="94" rx="12" fill="url(#apink)" ${O}/><rect x="18" y="62" width="164" height="34" rx="10" fill="url(#ared)" ${O}/><rect x="88" y="62" width="24" height="114" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/>`,
  },
  pirate: {
    A: `<path d="M100 26c38 0 62 26 62 60 0 20-8 36-20 46v22a10 10 0 0 1-10 10H68a10 10 0 0 1-10-10v-22c-12-10-20-26-20-46 0-34 24-60 62-60z" fill="#f2ead6" ${O}/><circle cx="76" cy="86" r="14" fill="#1a1008"/><circle cx="124" cy="86" r="14" fill="#1a1008"/><path d="M88 122h24l-6 14h-12z" fill="#1a1008"/>${hot(76, 58, 18, 10, -25)}`,
    K: `<circle cx="100" cy="40" r="16" fill="none" stroke="url(#asteel)" stroke-width="10"/><path d="M92 56h16v100h-16z" fill="url(#asteel)" ${O}/><path d="M56 84h88" stroke="url(#asteel)" stroke-width="14" stroke-linecap="round"/><path d="M100 178c-30 0-52-22-52-48h20c0 16 14 28 32 28s32-12 32-28h20c0 26-22 48-52 48z" fill="url(#asteel)" ${O}/>`,
    Q: `<circle cx="100" cy="100" r="70" fill="url(#agold)" ${O}/><circle cx="100" cy="100" r="52" fill="#f2ead6" stroke="#2a1204" stroke-width="5"/><path d="M100 58l14 34-14 8-14-8z" fill="url(#ared)" stroke="#2a1204" stroke-width="4"/><path d="M100 142l-14-34 14-8 14 8z" fill="#2a3a4e" stroke="#2a1204" stroke-width="4"/>`,
    J: `<path d="M84 22h32v22l14 20v112a12 12 0 0 1-12 12H82a12 12 0 0 1-12-12V64l14-20z" fill="url(#agreen)" ${O}/><rect x="78" y="96" width="44" height="40" rx="5" fill="#f2ead6" stroke="#2a1204" stroke-width="4"/>${hot(86, 66, 10, 16)}`,
    W: `<path d="M28 96h144a10 10 0 0 1 10 10v52a12 12 0 0 1-12 12H30a12 12 0 0 1-12-12v-52a10 10 0 0 1 10-10z" fill="url(#awood)" ${O}/><path d="M28 96c0-28 32-48 72-48s72 20 72 48z" fill="url(#awood)" ${O}/><rect x="18" y="92" width="164" height="16" rx="7" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/><rect x="86" y="112" width="28" height="30" rx="6" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/>`,
    S: `<circle cx="100" cy="100" r="62" fill="none" stroke="url(#awood)" stroke-width="18"/><circle cx="100" cy="100" r="24" fill="url(#awood)" ${O}/><g stroke="url(#awood)" stroke-width="14" stroke-linecap="round"><path d="M100 14v32M100 154v32M14 100h32M154 100h32M39 39l23 23M138 138l23 23M39 161l23-23M138 62l23-23"/></g>`,
    B: `<rect x="24" y="42" width="152" height="116" rx="10" fill="#f2e3bc" ${O}/><path d="M46 66c20 10 34 4 50 14s16 30 34 38" fill="none" stroke="#8a5a2a" stroke-width="6" stroke-dasharray="12 9"/><path d="M132 122l-12-12 24-6z" fill="url(#ared)" stroke="#2a1204" stroke-width="4"/>`,
  },
  neon: {
    A: `<path d="M100 168S28 122 28 76a36 36 0 0 1 72-12 36 36 0 0 1 72 12c0 46-72 92-72 92z" fill="url(#apink)" ${O}/><path d="M64 56a30 30 0 0 1 24 14" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".8"/>${hot(70, 70, 18, 10, -25)}`,
    K: `<path d="M34 44h132l-56 62v52h26v18H64v-18h26v-52z" fill="url(#acyan)" ${OC}/><path d="M54 58h92l-18 20H72z" fill="#fff" opacity=".4"/><circle cx="126" cy="40" r="12" fill="url(#agreen)" stroke="#2a1204" stroke-width="4"/>`,
    Q: `<circle cx="100" cy="100" r="72" fill="#1a1030" ${OC}/><circle cx="100" cy="100" r="72" fill="none" stroke="url(#apink)" stroke-width="10"/><circle cx="100" cy="100" r="40" fill="none" stroke="url(#acyan)" stroke-width="7"/><circle cx="100" cy="100" r="16" fill="url(#apink)" stroke="#0a2a3e" stroke-width="5"/>`,
    J: `<path d="M100 14l22 52 56 6-42 38 12 56-48-30-48 30 12-56L22 72l56-6z" fill="url(#acyan)" ${OC}/><path d="M100 14l22 52-22 12-22-12z" fill="#fff" opacity=".4"/>`,
    W: `<path d="M112 12 46 112h42l-14 76 74-104h-44z" fill="url(#agold)" ${O}/><path d="M108 26 66 100h20z" fill="#fff" opacity=".45"/>${hot(84, 58, 16, 10, -30)}`,
    S: `<circle cx="100" cy="100" r="62" fill="url(#apurple)" ${OC}/><g fill="#fff" opacity=".55"><circle cx="76" cy="70" r="9"/><circle cx="120" cy="66" r="7"/><circle cx="132" cy="106" r="9"/><circle cx="70" cy="118" r="8"/><circle cx="102" cy="132" r="7"/></g>`,
    B: `<rect x="26" y="76" width="70" height="70" rx="12" fill="#f4f0e6" ${O} transform="rotate(-10 61 111)"/><rect x="104" y="66" width="70" height="70" rx="12" fill="#f4f0e6" ${O} transform="rotate(12 139 101)"/><circle cx="46" cy="98" r="7" fill="url(#apink)"/><circle cx="76" cy="124" r="7" fill="url(#apink)"/><circle cx="124" cy="86" r="7" fill="url(#acyan)"/><circle cx="154" cy="116" r="7" fill="url(#acyan)"/>`,
  },
  frozen: {
    A: `<path d="M14 74l30 26 30-52 26 52 26-52 30 52 30-26-16 82H30z" fill="url(#agold)" ${O}/><rect x="28" y="152" width="144" height="20" rx="8" fill="url(#agold)" ${O}/><circle cx="72" cy="98" r="8" fill="url(#acyan)" stroke="#2a1204" stroke-width="4"/><circle cx="128" cy="98" r="8" fill="url(#acyan)" stroke="#2a1204" stroke-width="4"/>`,
    K: `<g stroke="url(#aice)" stroke-width="15" stroke-linecap="round"><path d="M100 16v168M28 58l144 84M172 58L28 142"/></g><g stroke="url(#aice)" stroke-width="11" stroke-linecap="round"><path d="M100 48l-22-18M100 48l22-18M100 152l-22 18M100 152l22 18M56 74l-28 2M144 126l28-2M144 74l28 2M56 126l-28-2"/></g>`,
    Q: `<path d="M100 18l40 60-40 104-40-104z" fill="url(#aice)" ${OC}/><path d="M100 18 60 78h80z" fill="#fff" opacity=".6"/><path d="M100 18v164l40-104z" fill="#0a3a55" opacity=".22"/>${hot(82, 54, 16, 9, -25)}`,
    J: `<g fill="url(#aice)" ${OC}><ellipse cx="100" cy="52" rx="22" ry="32"/><ellipse cx="142" cy="82" rx="22" ry="32" transform="rotate(72 142 82)"/><ellipse cx="126" cy="134" rx="22" ry="32" transform="rotate(144 126 134)"/><ellipse cx="74" cy="134" rx="22" ry="32" transform="rotate(216 74 134)"/><ellipse cx="58" cy="82" rx="22" ry="32" transform="rotate(288 58 82)"/></g><circle cx="100" cy="100" r="20" fill="url(#acyan)" stroke="#0a2a3e" stroke-width="5"/>`,
    W: `<path d="M100 12l26 54 58 8-42 42 10 58-52-28-52 28 10-58L16 74l58-8z" fill="url(#aice)" ${OC}/><path d="M100 12l26 54-26 14-26-14z" fill="#fff" opacity=".6"/>`,
    S: `<path d="M20 140c0-50 36-90 80-90s80 40 80 90" fill="none" stroke="url(#acyan)" stroke-width="20" stroke-linecap="round"/><path d="M44 142c0-38 25-68 56-68s56 30 56 68" fill="none" stroke="url(#apurple)" stroke-width="18" stroke-linecap="round"/><path d="M68 144c0-26 14-46 32-46s32 20 32 46" fill="none" stroke="url(#agreen)" stroke-width="16" stroke-linecap="round"/>`,
    B: `<rect x="26" y="86" width="148" height="86" rx="12" fill="url(#aice)" ${OC}/><path d="M26 86c0-26 32-44 74-44s74 18 74 44z" fill="url(#acyan)" ${OC}/><rect x="84" y="106" width="32" height="34" rx="6" fill="url(#agold)" stroke="#2a1204" stroke-width="5"/>`,
  },
  jungle: {
    A: `<path d="M100 22c32 0 52 22 52 52 0 18-6 32-16 42v30a12 12 0 0 1-12 12H76a12 12 0 0 1-12-12v-30c-10-10-16-24-16-42 0-30 20-52 52-52z" fill="url(#agold)" ${O}/><path d="M76 84h18v16H76zm30 0h18v16h-18z" fill="#1a3a2e"/><path d="M78 126h44l-8 18H86z" fill="#1a3a2e" opacity=".85"/>${hot(76, 56, 18, 10, -25)}`,
    K: `<path d="M46 62l16 22c10-8 22-12 38-12s28 4 38 12l16-22 10 40c6 12 8 24 8 34 0 34-32 58-72 58s-72-24-72-58c0-10 2-22 8-34z" fill="url(#awood)" ${O}/><circle cx="76" cy="112" r="11" fill="#f4e3b8" stroke="#2a1204" stroke-width="4"/><circle cx="124" cy="112" r="11" fill="#f4e3b8" stroke="#2a1204" stroke-width="4"/><path d="M88 140h24l-12 14z" fill="#2a1204"/><g fill="#2a1204" opacity=".5"><circle cx="58" cy="92" r="5"/><circle cx="142" cy="92" r="5"/><circle cx="64" cy="140" r="4"/><circle cx="136" cy="140" r="4"/></g>`,
    Q: `<rect x="60" y="26" width="80" height="150" rx="10" fill="url(#astone)" ${O}/><path d="M70 46h60v26H70zm0 40h60v26H70zm0 40h60v26H70z" fill="#4a4436" opacity=".7"/><path d="M52 26h96l-14-14H66z" fill="url(#astone)" ${O}/>`,
    J: `<path d="M100 176c0-60 34-104 76-124-6 44-30 84-76 124z" fill="url(#agreen)" ${O}/><path d="M100 176c0-60-34-104-76-124 6 44 30 84 76 124z" fill="url(#agreen)" ${O}/><path d="M100 176V80" stroke="#0a4a26" stroke-width="8" stroke-linecap="round"/>`,
    W: `<path d="M100 18l58 34v58c0 38-26 62-58 74-32-12-58-36-58-74V52z" fill="url(#agold)" ${O}/><path d="M100 54c18 0 30 14 30 30s-12 30-30 30-30-14-30-30 12-30 30-30z" fill="url(#agreen)" stroke="#2a1204" stroke-width="5"/><circle cx="100" cy="84" r="11" fill="#0a3a22"/>`,
    S: `<circle cx="100" cy="100" r="54" fill="url(#agold)" ${O}/><circle cx="100" cy="100" r="34" fill="url(#agreen)" stroke="#2a1204" stroke-width="5"/><g stroke="url(#agold)" stroke-width="12" stroke-linecap="round"><path d="M100 24v-14M100 190v-14M24 100H10M190 100h-14M46 46l-10-10M164 164l10 10M46 154l-10 10M164 36l10-10"/></g>`,
    B: `<path d="M30 168l30-110h80l30 110z" fill="url(#astone)" ${O}/><path d="M60 58l40-38 40 38z" fill="url(#astone)" ${O}/><rect x="82" y="112" width="36" height="56" rx="4" fill="#2a3a26" opacity=".85"/><path d="M46 118h108" stroke="#4a4436" stroke-width="7"/>`,
  },
};

/** Symbole, die dauerhaft leuchten sollen, damit sie sofort ins Auge fallen. */
const HIGHLIGHT: Record<string, "wild" | "scatter"> = { W: "wild", S: "scatter", B: "scatter" };

export function hasSymbolArt(set: string, code: string): boolean {
  return Boolean(SETS[set] && SETS[set][code as SymbolCode]);
}

export function SlotSymbol({
  set,
  code,
  winning = false,
}: Readonly<{ set: string; code: string; winning?: boolean }>) {
  const art = SETS[set]?.[code as SymbolCode];
  if (!art) return null;
  const accent = HIGHLIGHT[code];
  const classes = ["slot-sym", accent ? `slot-sym-${accent}` : "", winning ? "slot-sym-win" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      className={classes}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Symbol ${code}`}
      // Statische, im Modul definierte Grafik - kein Fremdinhalt.
      dangerouslySetInnerHTML={{ __html: `${G}<g filter="url(#adrop)">${art}</g>` }}
    />
  );
}
