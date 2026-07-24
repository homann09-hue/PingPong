"use client";

import { ArrowsOut } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { ArrowsIn } from "@phosphor-icons/react/dist/csr/ArrowsIn";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ImmersiveState = Readonly<{
  fullscreen: boolean;
  focus: boolean;
  sound: boolean;
  reducedFx: boolean;
}>;

const initialState: ImmersiveState = { fullscreen: false, focus: false, sound: true, reducedFx: false };

function readSoundState() {
  const button = document.querySelector<HTMLButtonElement>('.slot-actions button[aria-label="Ton aus"], .slot-actions button[aria-label="Ton an"]');
  return button?.getAttribute("aria-label") === "Ton aus";
}

export function SlotImmersiveControls() {
  const pathname = usePathname();
  const isSlotRoute = useMemo(() => /^\/slots\/[^/?#]+/.test(pathname), [pathname]);
  const [state, setState] = useState<ImmersiveState>(initialState);

  useEffect(() => {
    if (!isSlotRoute) {
      document.documentElement.classList.remove("slot-focus-mode", "slot-reduced-fx");
      setState(initialState);
      return undefined;
    }

    const sync = () => setState((current) => ({
      ...current,
      fullscreen: Boolean(document.fullscreenElement),
      sound: readSoundState(),
      focus: document.documentElement.classList.contains("slot-focus-mode"),
      reducedFx: document.documentElement.classList.contains("slot-reduced-fx"),
    }));

    sync();
    document.addEventListener("fullscreenchange", sync);
    const stage = document.querySelector(".slot-stage");
    const observer = stage ? new MutationObserver(sync) : null;
    observer?.observe(stage!, { attributes: true, childList: true, subtree: true });

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      observer?.disconnect();
      document.documentElement.classList.remove("slot-focus-mode", "slot-reduced-fx");
    };
  }, [isSlotRoute]);

  if (!isSlotRoute) return null;

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be unavailable in embedded browsers.
    }
  }

  function toggleFocus() {
    document.documentElement.classList.toggle("slot-focus-mode");
    setState((current) => ({ ...current, focus: !current.focus }));
  }

  function toggleSound() {
    document.querySelector<HTMLButtonElement>('.slot-actions button[aria-label="Ton aus"], .slot-actions button[aria-label="Ton an"]')?.click();
    window.setTimeout(() => setState((current) => ({ ...current, sound: readSoundState() })), 0);
  }

  function toggleReducedFx() {
    document.documentElement.classList.toggle("slot-reduced-fx");
    setState((current) => ({ ...current, reducedFx: !current.reducedFx }));
  }

  return <aside className="slot-immersive-controls" aria-label="Immersive Spielsteuerung">
    <span className="slot-immersive-kicker">Immersive Mode</span>
    <div>
      <button type="button" onClick={() => void toggleFullscreen()} aria-pressed={state.fullscreen}>
        {state.fullscreen ? <ArrowsIn weight="bold" aria-hidden="true" /> : <ArrowsOut weight="bold" aria-hidden="true" />}
        <span>{state.fullscreen ? "Vollbild aus" : "Vollbild"}</span>
      </button>
      <button type="button" onClick={toggleFocus} aria-pressed={state.focus} className={state.focus ? "is-active" : ""}>
        {state.focus ? <EyeSlash weight="fill" aria-hidden="true" /> : <Eye weight="fill" aria-hidden="true" />}
        <span>{state.focus ? "Panels zeigen" : "Fokus"}</span>
      </button>
      <button type="button" onClick={toggleSound} aria-pressed={state.sound} className={state.sound ? "is-active" : ""}>
        {state.sound ? <SpeakerHigh weight="fill" aria-hidden="true" /> : <SpeakerSlash weight="fill" aria-hidden="true" />}
        <span>{state.sound ? "Ton an" : "Ton aus"}</span>
      </button>
      <button type="button" onClick={toggleReducedFx} aria-pressed={state.reducedFx} className={state.reducedFx ? "is-active" : ""}>
        <Sparkle weight="fill" aria-hidden="true" />
        <span>{state.reducedFx ? "Effekte reduziert" : "Effekte"}</span>
      </button>
    </div>
  </aside>;
}
