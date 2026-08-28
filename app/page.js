'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

const NAMES = ['Ama', 'Kwame', 'Efua', 'Kofi', 'Adjoa', 'Yaw', 'Akosua', 'Kwesi', 'Abena', 'Nana'];
const AMOUNTS = ['₵2', '₵4', '₵6', '₵2', '₵10'];

const CATEGORIES = [
  '❤️ Emergency', '🎓 Education', '💼 Small business', '🎨 Creative',
  '⚽ Sports', '🏘️ Community', '🐶 Animal welfare',
];

export default function Home() {
  const tickerRef = useRef(null);
  const totalRef = useRef(null);
  const coinGridRef = useRef(null);

  useEffect(() => {
    const grid = coinGridRef.current;
    if (grid) {
      grid.innerHTML = '';
      for (let i = 0; i < 30; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin';
        coin.style.animationDelay = `${i * 0.025}s, ${2 + Math.random() * 2}s`;
        grid.appendChild(coin);
      }
    }

    const totalEl = totalRef.current;
    let start = null;
    const target = 8000;
    function countUp(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / 1200, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.floor(eased * target);
      if (totalEl) totalEl.textContent = `= ₵${val.toLocaleString()}`;
      if (progress < 1) requestAnimationFrame(countUp);
    }
    const timer = setTimeout(() => requestAnimationFrame(countUp), 800);

    function randomItem() {
      const n = NAMES[Math.floor(Math.random() * NAMES.length)];
      const a = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
      return `${n} gave ${a}`;
    }
    if (tickerRef.current) {
      const items = Array.from({ length: 10 }, randomItem);
      const html = [...items, ...items]
        .map((t) => `<span class="ticker-item"><span class="live-dot"></span>${t}</span>`)
        .join('');
      tickerRef.current.innerHTML = html;
    }

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{styles}</style>

      <div className="flag-rule" />

      <div className="wrap">
        <div className="float-coin" style={{ width: 34, top: 60, left: -6, animationDelay: '0s' }} />
        <div className="float-coin" style={{ width: 20, top: 140, right: 8, animationDelay: '1.4s' }} />
        <div className="float-coin" style={{ width: 16, top: 260, left: 12, animationDelay: '2.8s' }} />

        <header className="top">
          <div className="wordmark">VidFund<span className="dot">.</span></div>
        </header>

        <section className="hero">
          <h1>Small money<br /><span className="accent">adds up.</span></h1>
          <p className="sub">Start a fundraiser where everyone gives a little — and together, it's a lot.</p>
          <div className="cta-wrap">
            <Link href="/create" className="cta">Start a fundraiser →</Link>
          </div>

          <div className="ticker-wrap">
            <div className="ticker-track" ref={tickerRef} />
          </div>

          <div className="tally">
            <div className="tally-label">How ₵2 becomes ₵8,000</div>
            <div className="coin-grid" ref={coinGridRef} />
            <div className="tally-sum">
              <span>₵2 × 4,000 people</span>
              <span className="total" ref={totalRef}>= ₵0</span>
            </div>
          </div>
        </section>

        <section className="categories">
          <div className="categories-label">Not just emergencies</div>
          <div className="chip-row">
            {CATEGORIES.map((c) => (
              <div className="chip" key={c}>{c}</div>
            ))}
          </div>
        </section>

        <section className="how">
          <div className="categories-label">How it works</div>
          <div className="how-item">
            <div className="how-num">1</div>
            <div className="how-text"><strong>Set your amount.</strong> Choose what one person gives — ₵2, ₵5, whatever fits.</div>
          </div>
          <div className="how-item">
            <div className="how-num">2</div>
            <div className="how-text"><strong>Share the link.</strong> Post it to WhatsApp, TikTok, wherever your people are.</div>
          </div>
          <div className="how-item">
            <div className="how-num">3</div>
            <div className="how-text"><strong>Watch it add up.</strong> Every small gift moves you closer to the goal.</div>
          </div>
        </section>

        <footer>
          <Link href="/create" className="foot-cta">Start a fundraiser</Link>
          <div className="tag">VidFund — built for Ghana</div>
        </footer>
      </div>
    </>
  );
}

const styles = `
  :root {
    --green: #0B3D2E;
    --gold: #F2A93B;
    --terracotta: #D64933;
    --paper: #FFFBF2;
    --ink: #1A1A1A;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
  }
  .flag-rule {
    height: 5px;
    display: flex;
    background: linear-gradient(90deg, var(--terracotta) 0%, var(--terracotta) 33%, var(--gold) 33%, var(--gold) 66%, var(--green) 66%, var(--green) 100%);
    background-size: 200% 100%;
    animation: shimmer 6s ease-in-out infinite;
  }
  @keyframes shimmer { 0%, 100% { background-position: 0% 0; } 50% { background-position: 8% 0; } }
  .wrap { max-width: 480px; margin: 0 auto; padding: 0 20px; position: relative; font-family: 'Inter', sans-serif; color: var(--ink); }
  .float-coin { position: absolute; border-radius: 50%; background: var(--gold); opacity: 0.12; animation: float 7s ease-in-out infinite; pointer-events: none; aspect-ratio: 1; }
  @keyframes float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-14px) rotate(8deg); } }
  header.top { display: flex; align-items: center; justify-content: space-between; padding: 18px 0 0; opacity: 0; animation: fadeUp 0.5s ease-out 0.05s forwards; }
  .wordmark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
  .wordmark .dot { color: var(--gold); }
  .hero { padding: 36px 0 20px; background: radial-gradient(circle at 85% 8%, rgba(242,169,59,0.16), transparent 45%), repeating-linear-gradient(135deg, rgba(11,61,46,0.035) 0px, rgba(11,61,46,0.035) 2px, transparent 2px, transparent 18px); position: relative; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  h1 { font-family: 'Space Grotesk', sans-serif; font-size: 40px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 14px; opacity: 0; animation: fadeUp 0.6s ease-out 0.15s forwards; }
  h1 .accent { position: relative; white-space: nowrap; }
  h1 .accent::after { content: ''; position: absolute; left: -2px; right: -2px; bottom: 2px; height: 12px; background: var(--gold); z-index: -1; opacity: 0; transform: scaleX(0); transform-origin: left; animation: swipe 0.5s ease-out 0.7s forwards; }
  @keyframes swipe { to { opacity: 0.55; transform: scaleX(1); } }
  .sub { font-size: 16px; line-height: 1.5; color: #3a3a3a; max-width: 320px; margin: 0 0 26px; opacity: 0; animation: fadeUp 0.6s ease-out 0.28s forwards; }
  .cta-wrap { opacity: 0; animation: fadeUp 0.6s ease-out 0.4s forwards; }
  .cta { display: inline-block; background: var(--terracotta); color: #fff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; padding: 15px 26px; border-radius: 12px; text-decoration: none; box-shadow: 0 6px 0 #a5341f; transition: transform 0.08s, box-shadow 0.08s; animation: pulse 2.4s ease-in-out 1.2s infinite; }
  .cta:active { transform: translateY(4px); box-shadow: 0 2px 0 #a5341f; }
  @keyframes pulse { 0%, 100% { box-shadow: 0 6px 0 #a5341f, 0 0 0 0 rgba(214,73,51,0.35); } 50% { box-shadow: 0 6px 0 #a5341f, 0 0 0 8px rgba(214,73,51,0); } }
  .ticker-wrap { margin-top: 22px; overflow: hidden; white-space: nowrap; mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); opacity: 0; animation: fadeUp 0.6s ease-out 0.55s forwards; }
  .ticker-track { display: inline-flex; gap: 22px; animation: scroll-left 18s linear infinite; }
  .ticker-item { font-size: 13px; color: #555; font-family: 'IBM Plex Mono', monospace; display: inline-flex; align-items: center; gap: 6px; }
  .ticker-item .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); display: inline-block; animation: blink 1.6s ease-in-out infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes scroll-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .tally { margin-top: 26px; background: var(--green); border-radius: 18px; padding: 22px 20px 20px; color: #fff; position: relative; overflow: hidden; opacity: 0; animation: fadeUp 0.6s ease-out 0.7s forwards; }
  .tally-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.65); margin-bottom: 12px; font-weight: 600; }
  .coin-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; margin-bottom: 16px; }
  .coin { aspect-ratio: 1; border-radius: 50%; background: var(--gold); opacity: 0; transform: scale(0.3); animation: pop 0.35s ease-out forwards, glint 3s ease-in-out infinite; }
  @keyframes pop { to { opacity: 1; transform: scale(1); } }
  @keyframes glint { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
  .tally-sum { font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: rgba(255,255,255,0.9); border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px; display: flex; justify-content: space-between; align-items: baseline; }
  .tally-sum .total { font-size: 22px; font-weight: 600; color: var(--gold); font-variant-numeric: tabular-nums; }
  .categories { padding: 30px 0 10px; }
  .categories-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 600; margin-bottom: 12px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { background: #fff; border: 1.5px solid rgba(11,61,46,0.15); border-radius: 999px; padding: 8px 14px; font-size: 13.5px; font-weight: 500; color: var(--green); white-space: nowrap; transition: transform 0.15s, background 0.15s; }
  .chip:active { transform: scale(0.94); background: #f4f9f4; }
  .how { padding: 30px 0 10px; }
  .how-item { display: flex; gap: 14px; margin-bottom: 20px; opacity: 0; animation: fadeUp 0.5s ease-out forwards; }
  .how-item:nth-child(2) { animation-delay: 0.05s; }
  .how-item:nth-child(3) { animation-delay: 0.1s; }
  .how-num { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 13px; color: var(--gold); background: var(--green); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .how-text { font-size: 14.5px; line-height: 1.5; color: #333; }
  .how-text strong { color: var(--ink); }
  footer { padding: 30px 0 40px; text-align: center; }
  footer .foot-cta { display: block; width: 100%; background: var(--green); color: #fff; font-weight: 600; font-size: 16px; padding: 16px; border-radius: 12px; text-decoration: none; margin-bottom: 14px; transition: transform 0.1s; box-sizing: border-box; }
  footer .foot-cta:active { transform: scale(0.98); }
  footer .tag { font-size: 12px; color: #999; }
`;
