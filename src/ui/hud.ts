// DOM-based HUD: sun counter, seed cards, wave banner, game over overlay.
// Styled as charming paper "seed packets" with a chunky sun-coin HUD.
import { PLANT_SPECS, PlantType } from "../core/constants";
import type { Game } from "../game/game";

type CardEl = {
  el: HTMLElement;
  costEl: HTMLElement;
  cdMask: HTMLElement;
  readyAt: number;
  type: PlantType;
  selected: boolean;
};

// Parchment palette shared across the seed packets / sun badge.
const PAPER = "#f4e9cf"; // light paper body
const PAPER_FOLD = "#d8c393"; // folded top band
const PAPER_DARK = "#b5915c"; // darker edge / inner shadow
const INK = "#3a2a14"; // rich brown ink for names
const SUN_GOLD = "#ffd93d"; // sun coin gold

export class HUD {
  root: HTMLElement;
  game: Game;
  sunEl: HTMLElement;
  waveEl: HTMLElement;
  cards: CardEl[] = [];
  private cdEl: HTMLElement;
  private overEl: HTMLElement;
  private waveBanner: HTMLElement;
  private _waveText: HTMLElement;
  private sunValueEl: HTMLElement;
  private lastSun = -1;
  selectedType: PlantType | null = null;
  onSelect?: (t: PlantType | null) => void;

  constructor(game: Game, app: HTMLElement) {
    this.game = game;
    this.root = document.createElement("div");
    this.root.id = "hud";
    Object.assign(this.root.style, {
      position: "absolute", inset: "0", pointerEvents: "none",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    });
    app.appendChild(this.root);

    // ---- Top-left "title bar" frame + chunky sun coin --------------------
    const topLeft = document.createElement("div");
    Object.assign(topLeft.style, {
      position: "absolute", top: "10px", left: "12px",
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      gap: "4px", pointerEvents: "none", zIndex: "20",
    });
    this.root.appendChild(topLeft);

    // tiny "SUN" label above the coin for strategic clarity
    const sunLabel = document.createElement("div");
    sunLabel.textContent = "SUN";
    Object.assign(sunLabel.style, {
      fontSize: "10px", fontWeight: "900", letterSpacing: "2px",
      color: "#ffe9b0", textShadow: "0 1px 2px rgba(0,0,0,.7)",
      padding: "0 2px", opacity: "0.95",
    });
    topLeft.appendChild(sunLabel);

    // the chunky sun coin (orb + white rim) with the count in a dark badge
    this.sunEl = document.createElement("div");
    this.sunEl.className = "sun-counter";
    Object.assign(this.sunEl.style, {
      display: "flex", alignItems: "center", gap: "10px", pointerEvents: "none",
    });
    this.sunEl.innerHTML = `
      <span style="
        display:inline-flex;align-items:center;justify-content:center;
        width:58px;height:58px;border-radius:50%;
        background: radial-gradient(circle at 32% 28%, #fff6c8, ${SUN_GOLD} 42%, #ffb31a 72%, #e08b00 100%);
        box-shadow:
          0 0 0 4px rgba(255,255,255,.85),
          0 0 0 6px rgba(122,73,0,.55),
          inset -5px -6px 10px rgba(190,95,0,.55),
          inset 3px 3px 8px rgba(255,255,245,.9),
          0 4px 10px rgba(0,0,0,.45);
        color:#7a4900;font-size:30px;font-weight:900;
        text-shadow:0 1px 1px rgba(255,255,255,.6);">☀</span>
      <span style="
        display:inline-flex;align-items:center;justify-content:center;
        min-width:44px;height:44px;padding:0 10px;border-radius:12px;
        background: linear-gradient(#2a2118,#141009);
        border:2px solid ${SUN_GOLD};
        color:#fff;font-size:26px;font-weight:900;
        box-shadow:inset 0 3px 6px rgba(0,0,0,.6), 0 3px 8px rgba(0,0,0,.5);
        text-shadow:0 2px 3px rgba(0,0,0,.7);">${game.sun}</span>`;
    this.sunValueEl = this.sunEl.querySelector("span:last-of-type") as HTMLElement;
    topLeft.appendChild(this.sunEl);

    // ---- Wave indicator (small top-center pill) --------------------------
    this.waveEl = document.createElement("div");
    Object.assign(this.waveEl.style, {
      position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)",
      background: "linear-gradient(rgba(30,42,20,.75), rgba(15,24,12,.75))",
      backdropFilter: "blur(3px)", color: "#ffe9b0", padding: "7px 24px",
      borderRadius: "22px", fontSize: "17px", fontWeight: "900", letterSpacing: "2px",
      pointerEvents: "none", border: "2px solid rgba(255,233,176,.45)",
      boxShadow: "0 3px 8px rgba(0,0,0,.4)", zIndex: "20",
      textTransform: "uppercase",
    });
    this.waveEl.textContent = "Wave 1";
    this.root.appendChild(this.waveEl);

    // ---- Wave banner (big center flash) ----------------------------------
    this.waveBanner = document.createElement("div");
    Object.assign(this.waveBanner.style, {
      position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%) scale(0)",
      fontSize: "62px", fontWeight: "900", color: "#ffdd55", whiteSpace: "nowrap",
      textShadow: "0 4px 0 #6b3400, 0 8px 26px rgba(0,0,0,.6)", zIndex: "30",
      transition: "transform .2s cubic-bezier(.3,1.6,.5,1), opacity .15s", opacity: "1",
      fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "2px",
    });
    const waveText = document.createElement("span");
    waveText.style.paddingBottom = "14px";
    waveText.style.display = "inline-block";
    this.waveBanner.appendChild(waveText);
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      position: "absolute", left: "-6%", right: "-6%", bottom: "0",
      height: "8px", borderRadius: "4px",
      background: "linear-gradient(90deg, transparent, #f0cf8a 20%, #ffbe55 50%, #f0cf8a 80%, transparent)",
      boxShadow: "0 2px 6px rgba(0,0,0,.4)",
    });
    this.waveBanner.appendChild(bar);
    this._waveText = waveText;
    this.root.appendChild(this.waveBanner);

    // ---- Seed cards -------------------------------------------------------
    this.buildCards();

    // ---- Game over overlay -----------------------------------------------
    this.overEl = document.createElement("div");
    Object.assign(this.overEl.style, {
      position: "absolute", inset: "0", display: "none", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "22px",
      background: "radial-gradient(circle at 50% 30%, rgba(20,10,10,.5), rgba(5,2,2,.82))",
      zIndex: "50", pointerEvents: "auto", textAlign: "center",
    });
    this.overEl.innerHTML = `
      <div style="font-size:84px;line-height:1">😵</div>
      <div style="font-size:52px;font-weight:900;color:#ff6b6b;text-shadow:0 3px 8px rgba(0,0,0,.6);font-family:Georgia,'Times New Roman',serif;">LAWN OVERRUN!</div>
      <div style="font-size:22px;color:#ffe9b0;max-width:520px">The zombies reached the house.</div>
      <button id="restartBtn" style="
        pointerEvents:auto;padding:14px 48px 16px;font-size:22px;font-weight:900;
        border:none;border-radius:12px;cursor:pointer;font-family:Georgia,'Times New Roman',serif;
        background: linear-gradient(#f4e9cf,#d8c393);
        color:${INK};letter-spacing:1px;
        box-shadow: 0 4px 0 #9a7a3c, inset 0 2px 0 rgba(255,255,255,.6), 0 6px 14px rgba(0,0,0,.45);
        border-top:1px solid rgba(255,255,255,.5);
      ">🌱 PLANT AGAIN</button>
    `;
    this.overEl.querySelector("#restartBtn")!.addEventListener("click", () => location.reload());
    this.root.appendChild(this.overEl);

    this.cdEl = this.sunEl;
  }

  private buildCards() {
    // the seed tray at the bottom
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)",
      display: "flex", gap: "12px", padding: "14px 12px", borderRadius: "18px",
      background: "linear-gradient(rgba(25,38,22,.72), rgba(14,24,12,.72))",
      backdropFilter: "blur(4px)",
      borderTop: "1px solid rgba(255,255,255,.22)",
      borderLeft: "1px solid rgba(255,255,255,.12)",
      borderRight: "1px solid rgba(255,255,255,.12)",
      boxShadow: "0 6px 18px rgba(0,0,0,.5)", zIndex: "20",
    });
    this.root.appendChild(bar);

    (Object.keys(PLANT_SPECS) as PlantType[]).forEach((type) => {
      const spec = PLANT_SPECS[type];

      const card = document.createElement("div");
      Object.assign(card.style, {
        width: "78px", height: "116px", cursor: "pointer", pointerEvents: "auto",
        background: `linear-gradient(180deg, ${PAPER} 0%, ${PAPER} 100%)`,
        // packet silhouette: narrower at the bottom via clip-path
        clipPath: "polygon(4% 0%, 96% 0%, 100% 88%, 50% 100%, 0% 88%)",
        filter: "drop-shadow(0 6px 8px rgba(0,0,0,.4))",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "6px 6px 10px", position: "relative",
        transition: "transform .12s ease, filter .12s ease",
        boxSizing: "border-box",
      });
      // inner content wrapper (so clip-path doesn't clip the inner border oddly)
      const inner = document.createElement("div");
      Object.assign(inner.style, {
        position: "absolute", inset: "4px 4px 10px 4px",
        background: `linear-gradient(180deg, ${PAPER_FOLD} 0px, ${PAPER_FOLD} 26px, ${PAPER} 27px, ${PAPER} 100%)`,
        clipPath: "polygon(4% 0%, 96% 0%, 100% 90%, 50% 100%, 0% 90%)",
        boxShadow: "inset 0 0 0 1px " + PAPER_DARK,
        display: "flex", flexDirection: "column", alignItems: "center",
      });
      card.appendChild(inner);

      // folded top band + red/teal flap accent stitch
      const fold = document.createElement("div");
      Object.assign(fold.style, {
        position: "absolute", top: "0", left: "0", right: "0", height: "9px",
        background: "linear-gradient(180deg, rgba(255,255,255,.4), rgba(0,0,0,.12))",
        borderRadius: "2px 2px 0 0",
        borderBottom: "1px dashed rgba(90,60,20,.35)",
      });
      inner.appendChild(fold);

      // art window (darker circle inset) with the plant emoji
      const art = document.createElement("div");
      Object.assign(art.style, {
        width: "52px", height: "52px", borderRadius: "50%", marginTop: "10px",
        background: "radial-gradient(circle at 35% 30%, #e7d6ae, #cdb88a 70%, #b99f70)",
        boxShadow: "inset 0 0 0 3px " + PAPER_DARK + ", inset 0 4px 12px rgba(90,60,20,.5), 0 2px 5px rgba(90,60,20,.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "30px", lineHeight: "1",
      });
      art.textContent = spec.icon;
      inner.appendChild(art);

      // name in a bold handwritten serif
      const name = document.createElement("div");
      name.textContent = spec.name;
      Object.assign(name.style, {
        fontSize: "13px", fontWeight: "900", color: INK, letterSpacing: ".3px",
        fontFamily: "Georgia, 'Times New Roman', serif",
        textAlign: "center", marginTop: "6px", lineHeight: "1.05",
        textShadow: "0 1px 0 rgba(255,255,255,.35)",
        maxWidth: "100%", overflow: "hidden",
      });
      inner.appendChild(name);

      // cost as a chunky embossed sun badge
      const costEl = document.createElement("div");
      Object.assign(costEl.style, {
        position: "absolute", bottom: "6px", left: "50%", transform: "translateX(-50%)",
        minWidth: "34px", height: "34px", padding: "0 4px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 33% 28%, #fff6c8, " + SUN_GOLD + " 45%, #ffb31a 75%, #e08b00)",
        boxShadow: "inset -3px -4px 6px rgba(190,95,0,.5), inset 2px 2px 5px rgba(255,255,245,.8), 0 2px 4px rgba(60,35,0,.5)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", fontWeight: "900", color: "#6a3c00",
        textShadow: "0 1px 0 rgba(255,255,255,.55)",
      });
      costEl.innerHTML = `☀<span style="margin-left:2px">${spec.cost}</span>`;
      inner.appendChild(costEl);

      // tooltip: one-line desc bubble, hidden by default
      const tip = document.createElement("div");
      tip.textContent = spec.desc;
      Object.assign(tip.style, {
        position: "absolute", bottom: "104%", left: "-20px", right: "-20px",
        transform: "translateY(-8px)",
        background: "rgba(22,16,8,.92)", color: "#ffe9b0",
        border: "1px solid " + SUN_GOLD, borderRadius: "8px",
        padding: "6px 8px", fontSize: "12px", fontWeight: "700",
        textAlign: "center", pointerEvents: "none", zIndex: "40",
        opacity: "0", transition: "opacity .15s ease, transform .15s ease",
        whiteSpace: "nowrap", letterSpacing: ".3px",
      });
      card.appendChild(tip);

      // cooldown overlay: parchment "sprinkling water" sweep draining top-to-bottom
      const cd = document.createElement("div");
      Object.assign(cd.style, {
        position: "absolute", left: "0", right: "0", top: "0",
        height: "0%", overflow: "hidden",
        background: "repeating-linear-gradient(180deg, rgba(120,150,210,.22) 0 4px, rgba(90,115,180,.5) 4px 7px, rgba(120,150,210,.15) 7px 11px)",
        backdropFilter: "blur(1px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", fontWeight: "900", color: "#fff", zIndex: "15",
        textShadow: "0 2px 3px rgba(0,0,0,.8)",
        fontFamily: "Georgia, serif",
      });
      cd.textContent = "";
      inner.appendChild(cd);
      const cdMask = cd;

      // hover: raise packet slightly + reveal adjacents/tooltip
      card.addEventListener("mouseenter", () => {
        if (!(card as any)._selected) {
          card.style.transform = "translateY(-6px)";
        }
        tip.style.opacity = "1";
        tip.style.transform = "translateY(0)";
      });
      card.addEventListener("mouseleave", () => {
        if (!(card as any)._selected) {
          card.style.transform = "";
        }
        tip.style.opacity = "0";
        tip.style.transform = "translateY(-8px)";
      });

      card.addEventListener("click", () => {
        this.toggleSelect(type);
      });
      bar.appendChild(card);
      this.cards.push({ el: card, costEl, cdMask, readyAt: performance.now() / 1000 + spec.cooldown, type, selected: false });
    });
  }

  toggleSelect(t: PlantType) {
    const card = this.cards.find((c) => c.type === t)!;
    const now = performance.now() / 1000;
    if (now < card.readyAt) return;
    if (!this.game.canAfford(t)) return;
    if (this.selectedType === t) {
      this.selectedType = null;
      card.selected = false;
      (card.el as any)._selected = false;
      card.el.style.transform = "";
      this.setReadyState(card);
      this.onSelect?.(null);
    } else {
      this.cards.forEach((c) => {
        c.selected = false;
        (c.el as any)._selected = false;
        c.el.style.transform = "";
        this.setReadyState(c);
      });
      this.selectedType = t;
      card.selected = true;
      (card.el as any)._selected = true;
      card.el.style.transform = "translateY(-14px) scale(1.04)";
      this.setReadyState(card);
      this.onSelect?.(t);
    }
  }

  private setReadyState(c: CardEl) {
    const now = performance.now() / 1000;
    const ready = now >= c.readyAt && this.game.canAfford(c.type);
    if ((c.el as any)._selected) {
      // selected: warm outer glow ring
      c.el.style.filter =
        "drop-shadow(0 6px 8px rgba(0,0,0,.45)) " +
        "drop-shadow(0 0 10px rgba(255,204,80,.95))";
    } else if (ready) {
      // affordable + off cooldown: soft affordability glow (recharge-ready)
      c.el.style.filter =
        "drop-shadow(0 6px 8px rgba(0,0,0,.4)) " +
        "drop-shadow(0 0 7px rgba(255,224,120,.6))";
    } else {
      c.el.style.filter = "drop-shadow(0 6px 8px rgba(0,0,0,.4))";
    }
  }

  update(dt: number, game: Game) {
    const now = performance.now() / 1000;
    for (const c of this.cards) {
      const spec = PLANT_SPECS[c.type];
      const remain = Math.max(0, c.readyAt - now);
      const k = remain / spec.cooldown;
      c.cdMask.style.height = `${k * 100}%`;
      const affordable = game.canAfford(c.type) && remain <= 0;
      // strategic clarity: dim unaffordable/on-cooldown cards; keep ready ones vivid
      const dimmed = !affordable;
      if (!(c.el as any)._selected) {
        c.el.style.opacity = dimmed ? "0.6" : "1";
      } else {
        c.el.style.opacity = "1";
      }
      this.setReadyState(c);
      if (remain > 0) {
        c.cdMask.innerHTML = `${remain.toFixed(1)}<span style="font-size:9px">s</span>`;
        // mark the seconds panning within the parchment sweep
        c.cdMask.style.display = "flex";
        c.cdMask.style.alignItems = "flex-end";
        c.cdMask.style.paddingBottom = "30%";
      } else {
        c.cdMask.style.height = "0%";
        c.cdMask.innerHTML = "";
      }
    }

    // Sun counter: update value, add a subtle pop scale on change
    const s = Math.floor(game.sun);
    if (s !== this.lastSun) {
      const changed = this.lastSun !== -1;
      this.lastSun = s;
      this.sunValueEl.textContent = String(s);
      if (changed) {
        this.sunValueEl.style.transition = "transform .18s cubic-bezier(.3,1.6,.5,1)";
        this.sunValueEl.style.transform = "scale(1.25)";
        clearTimeout((this.sunValueEl as any)._popT);
        (this.sunValueEl as any)._popT = setTimeout(() => {
          this.sunValueEl.style.transform = "scale(1)";
        }, 180);
      }
    } else if (this.lastSun === -1) {
      this.lastSun = s;
      this.sunValueEl.textContent = String(s);
    }
  }

  triggerCooldown(type: PlantType) {
    const card = this.cards.find((c) => c.type === type)!;
    card.readyAt = performance.now() / 1000 + PLANT_SPECS[type].cooldown;
  }

  showWaveBanner(n: number) {
    this.waveEl.textContent = `Wave ${n}`;
    this._waveText.textContent = `WAVE ${n}`;
    this.waveBanner.style.transform = "translate(-50%,-50%) scale(1)";
    setTimeout(() => {
      this.waveBanner.style.transform = "translate(-50%,-50%) scale(0)";
    }, 720);
  }

  showGameOver() {
    this.overEl.style.display = "flex";
  }
}