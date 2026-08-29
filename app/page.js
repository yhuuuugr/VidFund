'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function Home() {
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
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{styles}</style>

      <div className="flag-rule" />

      <div className="wrap">
        <header className="top">
          <div className="wordmark">VidFund<span className="dot">.</span></div>
        </header>

        {/* Hero: speaks directly to the person who needs help, not a generic donor pitch */}
        <section className="hero">
          <h1>Tell your story.<br /><span className="accent">Get support.</span></h1>
          <p className="sub">Need help with something? Record your story and share it with people who care. ❤️</p>

          <div className="cta-wrap">
            <Link href="/create" className="cta">🎥 Start your fundraiser</Link>
          </div>
          <p className="reassure">Takes a few minutes. No long forms. Just your story.</p>

          {/* Visual cue: this is a video-first platform */}
          <div className="recordCard">
            <div className="recordDot" />
            <div className="recordIcon">🎥</div>
            <div className="recordCaption">Record your story right in the app</div>
          </div>
        </section>

        {/* The philosophy: explains WHY small suggested amounts work, to the creator */}
        <section className="philosophy">
          <div className="tally">
            <div className="tally-label">You don't need one person to give ₵8,000</div>
            <div className="coin-grid" ref={coinGridRef} />
            <div className="tally-sum">
              <span>You can get ₵5 from 1,600 people</span>
              <span className="total" ref={totalRef}>= ₵0</span>
            </div>
          </div>
        </section>

        <section className="quoteSection">
          <div className="quoteCard">
            <span className="quoteMark">"</span>
            <p className="quoteText">No one has ever become poor by giving.</p>
            <p className="quoteAuthor">— Anne Frank</p>
          </div>
        </section>

        {/* Three steps — the whole process, nothing else */}
        <section className="how">
          <div className="how-title">How VidFund works</div>
          <div className="how-item">
            <div className="how-emoji">🎥</div>
            <div>
              <div className="how-step-title">Tell your story</div>
              <div className="how-step-text">Record or upload a video explaining what you need.</div>
            </div>
          </div>
          <div className="how-item">
            <div className="how-emoji">🎯</div>
            <div>
              <div className="how-step-title">Set your goal</div>
              <div className="how-step-text">Choose how much you're trying to raise.</div>
            </div>
          </div>
          <div className="how-item">
            <div className="how-emoji">🔗</div>
            <div>
              <div className="how-step-title">Get your link</div>
              <div className="how-step-text">Share it on WhatsApp, TikTok, Instagram, anywhere.</div>
            </div>
          </div>
        </section>

        <footer>
          <Link href="/create" className="foot-cta">Start your fundraiser</Link>
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
  header.top { display: flex; align-items: center; justify-content: space-between; padding: 18px 0 0; opacity: 0; animation: fadeUp 0.5s ease-out 0.05s forwards; }
  .wordmark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
  .wordmark .dot { color: var(--gold); }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

  .hero { padding: 30px 0 10px; background: radial-gradient(circle at 85% 8%, rgba(242,169,59,0.16), transparent 45%); }
  h1 { font-family: 'Space Grotesk', sans-serif; font-size: 36px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 12px; opacity: 0; animation: fadeUp 0.6s ease-out 0.15s forwards; }
  h1 .accent { position: relative; white-space: nowrap; }
  h1 .accent::after { content: ''; position: absolute; left: -2px; right: -2px; bottom: 2px; height: 12px; background: var(--gold); z-index: -1; opacity: 0; transform: scaleX(0); transform-origin: left; animation: swipe 0.5s ease-out 0.7s forwards; }
  @keyframes swipe { to { opacity: 0.55; transform: scaleX(1); } }
  .sub { font-size: 16px; line-height: 1.5; color: #3a3a3a; max-width: 320px; margin: 0 0 20px; opacity: 0; animation: fadeUp 0.6s ease-out 0.28s forwards; }

  .cta-wrap { opacity: 0; animation: fadeUp 0.6s ease-out 0.4s forwards; }
  .cta {
    display: block; text-align: center; width: 100%; box-sizing: border-box;
    background: var(--terracotta); color: #fff; font-family: 'Inter', sans-serif;
    font-weight: 700; font-size: 17px; padding: 17px 20px; border-radius: 12px;
    text-decoration: none; box-shadow: 0 6px 0 #a5341f;
    transition: transform 0.08s, box-shadow 0.08s;
    animation: pulse 2.4s ease-in-out 1.2s infinite;
  }
  .cta:active { transform: translateY(4px); box-shadow: 0 2px 0 #a5341f; }
  @keyframes pulse { 0%, 100% { box-shadow: 0 6px 0 #a5341f, 0 0 0 0 rgba(214,73,51,0.35); } 50% { box-shadow: 0 6px 0 #a5341f, 0 0 0 8px rgba(214,73,51,0); } }

  .reassure { font-size: 13px; color: #888; text-align: center; margin: 10px 0 24px; opacity: 0; animation: fadeUp 0.6s ease-out 0.5s forwards; }

  .recordCard {
    position: relative;
    background: var(--green);
    border-radius: 18px;
    padding: 28px 20px;
    text-align: center;
    color: #fff;
    opacity: 0;
    animation: fadeUp 0.6s ease-out 0.62s forwards;
    margin-bottom: 30px;
  }
  .recordDot {
    position: absolute; top: 14px; left: 16px;
    width: 9px; height: 9px; border-radius: 50%; background: var(--terracotta);
    animation: blink 1.4s ease-in-out infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  .recordIcon { font-size: 40px; margin-bottom: 10px; }
  .recordCaption { font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 500; }

  .philosophy { padding-bottom: 10px; }
  .tally { background: var(--green); border-radius: 18px; padding: 22px 20px 20px; color: #fff; position: relative; overflow: hidden; }
  .tally-label { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 12px; font-weight: 600; line-height: 1.4; }
  .coin-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; margin-bottom: 16px; }
  .coin { aspect-ratio: 1; border-radius: 50%; background: var(--gold); opacity: 0; transform: scale(0.3); animation: pop 0.35s ease-out forwards, glint 3s ease-in-out infinite; }
  @keyframes pop { to { opacity: 1; transform: scale(1); } }
  @keyframes glint { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
  .tally-sum { font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; color: rgba(255,255,255,0.9); border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .tally-sum .total { font-size: 20px; font-weight: 600; color: var(--gold); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .quoteSection { padding: 26px 0 4px; }
  .quoteCard { text-align: center; padding: 4px 10px; }
  .quoteMark { font-family: 'Space Grotesk', sans-serif; font-size: 40px; color: var(--gold); line-height: 0.5; display: block; margin-bottom: 6px; }
  .quoteText { font-size: 16px; font-style: italic; color: #333; line-height: 1.5; margin: 0 0 6px; }
  .quoteAuthor { font-size: 12.5px; color: #999; font-weight: 600; margin: 0; }

  .how { padding: 30px 0 10px; }
  .how-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 700; margin-bottom: 16px; }
  .how-item { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 22px; }
  .how-emoji {
    width: 42px; height: 42px; border-radius: 12px; background: #f4f9f4;
    display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
  }
  .how-step-title { font-size: 15.5px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
  .how-step-text { font-size: 14px; color: #555; line-height: 1.45; }

  footer { padding: 20px 0 40px; text-align: center; }
  footer .foot-cta { display: block; width: 100%; box-sizing: border-box; background: var(--green); color: #fff; font-weight: 700; font-size: 16px; padding: 16px; border-radius: 12px; text-decoration: none; margin-bottom: 14px; transition: transform 0.1s; }
  footer .foot-cta:active { transform: scale(0.98); }
  footer .tag { font-size: 12px; color: #999; }
`;
