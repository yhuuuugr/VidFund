'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function Home() {
  const totalRef = useRef(null);
  const amountLineRef = useRef(null);
  const coinGridRef = useRef(null);
  const quoteTextRef = useRef(null);
  const quoteAuthorRef = useRef(null);
  const heroRef = useRef(null);
  const howSectionRef = useRef(null);

  const quotesRef = useRef([
    { text: 'No one has ever become poor by giving.', author: 'Anne Frank' },
    { text: 'We rise by lifting others.', author: 'Robert Ingersoll' },
    { text: 'No act of kindness, no matter how small, is ever wasted.', author: 'Aesop' },
    { text: 'Alone we can do so little; together we can do so much.', author: 'Helen Keller' },
  ]);
  const quoteIndexRef = useRef(0);
  const quoteTimersRef = useRef({ timeout: null, interval: null });

  useEffect(() => {
    // Hero pops in (and resets) every time it scrolls into/out of view,
    // and each time it comes into view, the quote retypes — cycling to the next one
    const hero = heroRef.current;
    const textEl = quoteTextRef.current;
    const authorEl = quoteAuthorRef.current;
    if (!hero || !textEl) return;

    const clearTimers = () => {
      clearTimeout(quoteTimersRef.current.timeout);
      clearInterval(quoteTimersRef.current.interval);
    };

    const playQuote = () => {
      clearTimers();
      const quotes = quotesRef.current;
      const q = quotes[quoteIndexRef.current % quotes.length];
      quoteIndexRef.current += 1;

      textEl.textContent = '';
      textEl.classList.remove('typed-done');
      textEl.classList.add('typing');
      if (authorEl) authorEl.textContent = `— ${q.author}`;

      let i = 0;
      quoteTimersRef.current.timeout = setTimeout(() => {
        quoteTimersRef.current.interval = setInterval(() => {
          i++;
          textEl.textContent = q.text.slice(0, i);
          if (i >= q.text.length) {
            clearInterval(quoteTimersRef.current.interval);
            textEl.classList.remove('typing');
            textEl.classList.add('typed-done');
          }
        }, 45);
      }, 350);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hero.classList.add('in-view');
          playQuote();
        } else {
          hero.classList.remove('in-view');
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(hero);

    return () => {
      observer.disconnect();
      clearTimers();
    };
  }, []);

  useEffect(() => {
    // Reveal the "How it played out" steps every time the section scrolls into view,
    // and reset when it scrolls out, so it pops in again on the way back too
    const section = howSectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          section.classList.add('in-view');
        } else {
          section.classList.remove('in-view');
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Build the 30-coin grid, each coin sharing one real coin photo
    const grid = coinGridRef.current;
    const coins = [];
    if (grid) {
      grid.innerHTML = '';
      for (let i = 0; i < 30; i++) {
        const cell = document.createElement('div');
        cell.className = 'coin-cell';
        const coin = document.createElement('div');
        coin.className = 'coin';
        coin.style.animationDelay = `${i * 0.02}s`;
        cell.appendChild(coin);
        grid.appendChild(cell);
        coins.push(coin);
      }
    }

    // Randomly flip a few coins at a time, forever, so the card feels alive
    function flipRandomCoins() {
      const howMany = 2 + Math.floor(Math.random() * 3); // 2-4 coins
      const chosen = new Set();
      while (chosen.size < howMany && chosen.size < coins.length) {
        chosen.add(Math.floor(Math.random() * coins.length));
      }
      chosen.forEach((idx) => {
        const c = coins[idx];
        c.classList.remove('flip');
        void c.offsetWidth; // restart animation
        c.classList.add('flip');
      });
    }
    const flipInterval = setInterval(flipRandomCoins, 1400);
    const flipTimeout = setTimeout(flipRandomCoins, 900);

    // Cycle through many different, real ways to reach the same ₵8,000 goal.
    // Each pair multiplies out to exactly 8000; picked at random each time
    // (never repeating the same one twice in a row) so it feels like it's
    // actively recalculating rather than replaying a fixed loop.
    const combos = [
      { amount: 5, people: 1600 },
      { amount: 2, people: 4000 },
      { amount: 10, people: 800 },
      { amount: 1, people: 8000 },
      { amount: 20, people: 400 },
      { amount: 8, people: 1000 },
      { amount: 25, people: 320 },
      { amount: 40, people: 200 },
      { amount: 50, people: 160 },
      { amount: 16, people: 500 },
      { amount: 100, people: 80 },
      { amount: 80, people: 100 },
      { amount: 200, people: 40 },
      { amount: 250, people: 32 },
      { amount: 400, people: 20 },
    ];
    const TARGET = 8000;
    const totalEl = totalRef.current;
    const amountLineEl = amountLineRef.current;
    let lastIndex = 0;

    function pickNextCombo() {
      let idx;
      do {
        idx = Math.floor(Math.random() * combos.length);
      } while (idx === lastIndex);
      lastIndex = idx;
      return combos[idx];
    }

    function renderCombo(combo) {
      if (!amountLineEl) return;
      amountLineEl.innerHTML = `<span class="fade">You can get ₵${combo.amount} from ${combo.people.toLocaleString()} people</span>`;
    }

    function countUpTotal() {
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 900, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = Math.floor(eased * TARGET);
        if (totalEl) totalEl.textContent = `= ₵${val.toLocaleString()}`;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    renderCombo(combos[0]);
    const firstCountTimeout = setTimeout(countUpTotal, 700);
    const comboInterval = setInterval(() => {
      renderCombo(pickNextCombo());
      countUpTotal();
    }, 3200);

    return () => {
      clearInterval(flipInterval);
      clearTimeout(flipTimeout);
      clearTimeout(firstCountTimeout);
      clearInterval(comboInterval);
    };
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
        <section className="hero" ref={heroRef}>
          <h1>
            <span className="line line1">Tell your story.</span>
            <br />
            <span className="line line2 accent">Get support.</span>
          </h1>

          <div className="quoteCard">
            <span className="quoteMark">"</span>
            <p className="quoteText" ref={quoteTextRef}></p>
            <p className="quoteAuthor" ref={quoteAuthorRef}>— Anne Frank</p>
          </div>

          <p className="sub">Need help with something? Record your story and share it with people who care. ❤️</p>

          <div className="cta-wrap">
            <Link href="/create" className="cta">
              <span className="ctaCamWrap"><img className="ctaCamImg" src="/record-camera.png" alt="" /></span>
              Start your fundraiser
            </Link>
          </div>
          <p className="reassure">Takes a few minutes. No long forms. Just your story.</p>

          {/* Visual cue: this is a video-first platform */}
          <div className="recordCard">
            <div className="recordDot" />
            <div className="camWrap">
              <img className="camImg" src="/record-camera.png" alt="Video camera" />
            </div>
            <div className="recordCaption">Record right in the app, or upload your own video</div>
          </div>
        </section>

        {/* The philosophy: explains WHY small suggested amounts work, to the creator */}
        <section className="philosophy">
          <div className="tally">
            <div className="tally-label">You don't need one person to give ₵8,000</div>
            <div className="coin-grid" ref={coinGridRef} />
            <div className="tally-sum">
              <span className="amount-line" ref={amountLineRef}>
                <span className="fade">You can get ₵5 from 1,600 people</span>
              </span>
              <span className="total" ref={totalRef}>= ₵0</span>
            </div>
          </div>
        </section>

        {/* Same 3 steps, told as one story instead of dry instructions */}
        <section className="how" ref={howSectionRef}>
          <div className="how-title how-reveal">How it played out for Ama</div>
          <p className="how-intro how-reveal">Her shop flooded and she needed ₵800 to restock. Here's what she did.</p>

          <div className="how-item how-reveal">
            <div className="how-emoji"><img src="/record-camera.png" alt="" className="how-icon-img" /></div>
            <div className="how-step-content">
              <div className="how-step-title">She recorded a 60-second video</div>
              <div className="how-step-text">No script, no editing — just her explaining what happened, right from her phone.</div>
            </div>
          </div>
          <div className="how-item how-reveal">
            <div className="how-emoji"><img src="/how-target.png" alt="" className="how-icon-img" /></div>
            <div className="how-step-content">
              <div className="how-step-title">She set a goal of ₵800</div>
              <div className="how-step-text">Small and specific — exactly what she needed to reopen, nothing more.</div>
            </div>
          </div>
          <div className="how-item how-reveal">
            <div className="how-emoji"><img src="/how-link.png" alt="" className="how-icon-img" /></div>
            <div className="how-step-content">
              <div className="how-step-title">She shared her link in a WhatsApp group</div>
              <div className="how-step-text">Family, friends, and their friends — passed along from person to person.</div>
            </div>
          </div>

          <div className="how-outcome how-reveal">
            Within a week, 340 people had each given a little. <strong>Her shop reopened that Saturday.</strong>
          </div>
        </section>

        <p className="creator-note">
          Also a content creator? Get the same kind of support from your fans — record a video, set an amount, share your link.
        </p>

        <footer>
          <Link href="/create" className="foot-cta">Start your fundraiser</Link>
          <div className="tag">VidFund — built for Ghana</div>
          <div className="legal-links">
            <Link href="/terms" className="terms-link">Terms of Service</Link>
            <span> · </span>
            <Link href="/privacy" className="terms-link">Privacy Policy</Link>
          </div>
        </footer>
      </div>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; }
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
  h1 { font-family: 'Space Grotesk', sans-serif; font-size: 36px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 12px; }
  h1 .line { display: inline-block; opacity: 0; transform: translateY(28px) scale(0.9); }
  .hero.in-view h1 .line { animation: popIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .hero.in-view h1 .line1 { animation-delay: 0.15s; }
  .hero.in-view h1 .line2 { animation-delay: 0.42s; }
  @keyframes popIn { 0% { opacity: 0; transform: translateY(28px) scale(0.9); } 60% { opacity: 1; transform: translateY(-4px) scale(1.03); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  h1 .accent { position: relative; white-space: nowrap; }
  h1 .accent::after { content: ''; position: absolute; left: -2px; right: -2px; bottom: 2px; height: 12px; background: var(--gold); z-index: -1; opacity: 0; transform: scaleX(0); transform-origin: left; }
  .hero.in-view h1 .accent::after { animation: swipe 0.5s ease-out 0.9s forwards; }
  @keyframes swipe { to { opacity: 0.55; transform: scaleX(1); } }
  .sub { font-size: 16px; line-height: 1.5; color: #3a3a3a; max-width: 320px; margin: 0 0 20px; opacity: 0; }
  .hero.in-view .sub { animation: fadeUp 0.6s ease-out 0.28s forwards; }

  .cta-wrap { opacity: 0; }
  .hero.in-view .cta-wrap { animation: fadeUp 0.6s ease-out 0.4s forwards; }
  .cta {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    text-align: center; width: 100%; box-sizing: border-box;
    background: var(--terracotta); color: #fff; font-family: 'Inter', sans-serif;
    font-weight: 700; font-size: 17px; padding: 17px 20px; border-radius: 12px;
    text-decoration: none; box-shadow: 0 6px 0 #a5341f;
    transition: transform 0.08s, box-shadow 0.08s;
    animation: pulse 2.4s ease-in-out 1.2s infinite;
  }
  .cta:active { transform: translateY(4px); box-shadow: 0 2px 0 #a5341f; }
  @keyframes pulse { 0%, 100% { box-shadow: 0 6px 0 #a5341f, 0 0 0 0 rgba(214,73,51,0.35); } 50% { box-shadow: 0 6px 0 #a5341f, 0 0 0 8px rgba(214,73,51,0); } }

  .ctaCamWrap { display: inline-flex; perspective: 300px; flex-shrink: 0; }
  .ctaCamImg {
    height: 26px; width: auto; object-fit: contain;
    animation: turnAroundSmall 5s linear infinite;
    transform-style: preserve-3d;
  }
  @keyframes turnAroundSmall {
    0%   { transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
  }

  .reassure { font-size: 13px; color: #888; text-align: center; margin: 10px 0 24px; opacity: 0; }
  .hero.in-view .reassure { animation: fadeUp 0.6s ease-out 0.5s forwards; }

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
    perspective: 600px;
  }
  .recordDot {
    position: absolute; top: 14px; left: 16px;
    width: 9px; height: 9px; border-radius: 50%; background: var(--terracotta);
    animation: blink 1.4s ease-in-out infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  .camWrap {
    display: flex; justify-content: center; align-items: flex-end; height: 150px; margin-bottom: 6px;
    opacity: 0;
    animation: settleCam 0.7s cubic-bezier(0.2,0.9,0.3,1) forwards;
  }
  .camImg {
    max-height: 140px; max-width: 88%; object-fit: contain;
    filter: drop-shadow(0 14px 18px rgba(0,0,0,0.45));
    animation: moveBackFront 4s ease-in-out infinite;
    transform-origin: center bottom;
  }
  @keyframes moveBackFront {
    0%, 100% { transform: translateZ(0) scale(1); filter: drop-shadow(0 14px 18px rgba(0,0,0,0.45)); }
    50%      { transform: translateZ(60px) scale(1.09); filter: drop-shadow(0 20px 22px rgba(0,0,0,0.55)); }
  }
  @keyframes settleCam {
    from { opacity: 0; transform: translateY(30px) scale(0.92); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .recordCaption { font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 500; }

  .philosophy { padding-bottom: 10px; }
  .tally { background: var(--green); border-radius: 18px; padding: 22px 20px 20px; color: #fff; position: relative; overflow: hidden; }
  .tally-label { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 12px; font-weight: 600; line-height: 1.4; }
  .coin-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; margin-bottom: 16px; perspective: 400px; }
  .coin-cell { aspect-ratio: 1; }
  .coin {
    width: 100%; height: 100%;
    border-radius: 50%;
    background-image: url('/coin.jpg');
    background-size: cover;
    background-position: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.35) inset;
    transform-style: preserve-3d;
    animation: settle 0.4s ease-out both;
  }
  @keyframes settle { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
  .coin.flip { animation: flip 1.1s ease-in-out; }
  @keyframes flip {
    0%   { transform: rotateY(0deg) scale(1); }
    45%  { transform: rotateY(180deg) scale(1.08); filter: brightness(1.25); }
    100% { transform: rotateY(360deg) scale(1); filter: brightness(1); }
  }
  .tally-sum { font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; color: rgba(255,255,255,0.9); border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .tally-sum .amount-line { position: relative; display: inline-block; }
  .tally-sum .amount-line .fade { display: inline-block; animation: swapText 0.4s ease-out both; }
  @keyframes swapText { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .tally-sum .total { font-size: 20px; font-weight: 600; color: var(--gold); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .quoteCard {
    text-align: center;
    padding: 18px 14px 16px;
    margin: 18px 0 20px;
    background: linear-gradient(180deg, rgba(242,169,59,0.14), rgba(242,169,59,0.04));
    border-radius: 16px;
    border: 1px solid rgba(242,169,59,0.3);
    opacity: 0;
  }
  .hero.in-view .quoteCard { animation: fadeUp 0.6s ease-out 0.2s forwards; }
  .quoteMark { font-family: 'Space Grotesk', sans-serif; font-size: 56px; color: var(--gold); line-height: 0.4; display: block; margin-bottom: 8px; }
  .quoteText { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; font-style: italic; color: var(--green); line-height: 1.35; margin: 0 0 8px; min-height: 1.35em; }
  .quoteText.typing::after { content: ''; display: inline-block; width: 2px; height: 1em; background: var(--green); margin-left: 2px; vertical-align: -2px; animation: cursorBlink 0.8s step-end infinite; }
  .quoteText.typed-done::after { content: ''; display: inline-block; width: 2px; height: 1em; background: var(--green); margin-left: 2px; vertical-align: -2px; animation: cursorBlink 0.8s step-end infinite; opacity: 0.5; }
  @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .quoteAuthor { font-size: 13px; color: #8a6a2a; font-weight: 600; margin: 0; }

  .how { padding: 30px 0 10px; }
  .how-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 700; margin-bottom: 6px; }
  .how-intro { font-size: 15px; color: #444; line-height: 1.5; margin: 0 0 20px; }
  .how-item { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 22px; }
  .how-step-content { flex: 1; min-width: 0; }

  .how-reveal { opacity: 0; transform: translateY(22px) scale(0.97); }
  .how.in-view .how-reveal { animation: howPop 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .how.in-view .how-title { animation-delay: 0s; }
  .how.in-view .how-intro { animation-delay: 0.1s; }
  .how.in-view .how-item:nth-of-type(2) { animation-delay: 0.22s; }
  .how.in-view .how-item:nth-of-type(3) { animation-delay: 0.38s; }
  .how.in-view .how-item:nth-of-type(4) { animation-delay: 0.54s; }
  .how.in-view .how-outcome { animation-delay: 0.7s; }
  @keyframes howPop {
    from { opacity: 0; transform: translateY(22px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .how-emoji {
    width: 42px; height: 42px; border-radius: 12px; background: #f4f9f4;
    display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
    overflow: visible; perspective: 300px;
  }
  .how-icon-img {
    width: 78%; height: 78%; object-fit: contain;
    animation: howIconFrontBack 3.6s ease-in-out infinite;
    transform-origin: center bottom;
  }
  @keyframes howIconFrontBack {
    0%, 100% { transform: translateZ(0) scale(1); }
    50%      { transform: translateZ(26px) scale(1.16); }
  }
  .how-item:nth-of-type(2) .how-icon-img { animation-delay: 0.3s; }
  .how-item:nth-of-type(3) .how-icon-img { animation-delay: 0.6s; }
  .how-item:nth-of-type(4) .how-icon-img { animation-delay: 0.9s; }
  .how-step-title { font-size: 15.5px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
  .how-step-text { font-size: 14px; color: #555; line-height: 1.45; }
  .how-outcome {
    background: linear-gradient(180deg, rgba(11,61,46,0.06), rgba(11,61,46,0.02));
    border-left: 3px solid var(--green);
    border-radius: 10px;
    padding: 14px 16px;
    font-size: 14.5px;
    color: #333;
    line-height: 1.55;
    margin-top: 6px;
  }
  .how-outcome strong { color: var(--green); }

  footer { padding: 20px 0 40px; text-align: center; }
  footer .foot-cta { display: block; width: 100%; box-sizing: border-box; background: var(--green); color: #fff; font-weight: 700; font-size: 16px; padding: 16px; border-radius: 12px; text-decoration: none; margin-bottom: 14px; transition: transform 0.1s; }
  footer .foot-cta:active { transform: scale(0.98); }
  footer .tag { font-size: 12px; color: #999; }
  footer .legal-links { margin-top: 8px; }
  footer .terms-link { font-size: 12px; color: #999; text-decoration: underline; }
  .creator-note { font-size: 13px; color: #999; text-align: center; padding: 0 10px; margin: 4px 0 0; line-height: 1.5; }
`;
