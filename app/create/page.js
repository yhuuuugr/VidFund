'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { nanoid } from 'nanoid';

const CATEGORIES = [
  { id: 'emergency', label: 'Emergency', emoji: '❤️' },
  { id: 'education', label: 'Education', emoji: '🎓' },
  { id: 'business', label: 'Small business', emoji: '💼' },
  { id: 'creative', label: 'Creative project', emoji: '🎨' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'community', label: 'Community', emoji: '🏘️' },
  { id: 'animals', label: 'Animal welfare', emoji: '🐶' },
  { id: 'school', label: 'School project', emoji: '📚' },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export default function CreateCampaign() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState('emergency');
  const [videoFile, setVideoFile] = useState(null);
  const [suggestedAmount, setSuggestedAmount] = useState(2);

  // Creator can specify the goal either as a target total amount (₵)
  // or as a target number of supporters — whichever is more intuitive for them.
  const [goalMode, setGoalMode] = useState('amount'); // 'amount' | 'people'
  const [targetAmount, setTargetAmount] = useState(8000);
  const [targetPeople, setTargetPeople] = useState(4000);

  const [creatorName, setCreatorName] = useState('');
  const [momoNumber, setMomoNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const suggested = Number(suggestedAmount) || 0;

  // Whichever field the creator is editing drives the other, purely for display.
  const derivedPeople = useMemo(() => {
    if (goalMode === 'people') return Number(targetPeople) || 0;
    if (!suggested) return 0;
    return Math.ceil((Number(targetAmount) || 0) / suggested);
  }, [goalMode, targetPeople, targetAmount, suggested]);

  const derivedTotal = useMemo(() => {
    if (goalMode === 'amount') return Number(targetAmount) || 0;
    return suggested * (Number(targetPeople) || 0);
  }, [goalMode, targetAmount, targetPeople, suggested]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let videoUrl = null;

      if (videoFile) {
        const fileName = `${nanoid()}-${videoFile.name}`;
        const { data, error: uploadError } = await supabase.storage
          .from('campaign-videos')
          .upload(fileName, videoFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('campaign-videos')
          .getPublicUrl(data.path);
        videoUrl = publicUrlData.publicUrl;
      }

      const slug = `${slugify(title)}-${nanoid(5)}`;
      const targetUnits = derivedPeople;

      const { error: insertError } = await supabase.from('campaigns').insert({
        slug,
        title,
        story,
        category,
        video_url: videoUrl,
        suggested_amount: suggested,
        target_units: targetUnits,
        creator_name: creatorName,
        creator_momo_number: momoNumber,
      });

      if (insertError) throw insertError;

      router.push(`/create/success?slug=${slug}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>Start a fundraiser</h1>
      <p style={styles.sub}>Small amounts from many people add up fast.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Title
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Help Ama restock her shop"
            required
          />
        </label>

        <label style={styles.label}>
          Story
          <textarea
            style={{ ...styles.input, minHeight: 120 }}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Tell people what this is for and why it matters."
            required
          />
        </label>

        <label style={styles.label}>
          Category
          <select
            style={styles.input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Video (shown first, autoplays muted)
          <input
            style={styles.input}
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
        </label>

        <div style={styles.calcBox}>
          <label style={styles.label}>
            Suggested amount per person (₵)
            <input
              style={styles.input}
              type="number"
              min="1"
              step="0.5"
              value={suggestedAmount}
              onChange={(e) => setSuggestedAmount(e.target.value)}
              required
            />
          </label>

          <div style={styles.toggleRow}>
            <button
              type="button"
              onClick={() => setGoalMode('amount')}
              style={{ ...styles.toggleBtn, ...(goalMode === 'amount' ? styles.toggleBtnActive : {}) }}
            >
              Set a target amount
            </button>
            <button
              type="button"
              onClick={() => setGoalMode('people')}
              style={{ ...styles.toggleBtn, ...(goalMode === 'people' ? styles.toggleBtnActive : {}) }}
            >
              Set number of people
            </button>
          </div>

          {goalMode === 'amount' ? (
            <label style={styles.label}>
              Target amount (₵)
              <input
                style={styles.input}
                type="number"
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </label>
          ) : (
            <label style={styles.label}>
              How many people
              <input
                style={styles.input}
                type="number"
                min="1"
                value={targetPeople}
                onChange={(e) => setTargetPeople(e.target.value)}
                required
              />
            </label>
          )}

          <p style={styles.calcNote}>
            {goalMode === 'amount' ? (
              <>Needs about <strong>{derivedPeople.toLocaleString()}</strong> people giving ₵{suggested.toFixed(2)} each to reach <strong>₵{derivedTotal.toLocaleString()}</strong></>
            ) : (
              <>Small money combines to be big: ₵{suggested.toFixed(2)} × {derivedPeople.toLocaleString()} people = <strong>₵{derivedTotal.toLocaleString()}</strong></>
            )}
          </p>
        </div>

        <label style={styles.label}>
          Your name
          <input
            style={styles.input}
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            required
          />
        </label>

        <label style={styles.label}>
          MoMo number for payout
          <input
            style={styles.input}
            value={momoNumber}
            onChange={(e) => setMomoNumber(e.target.value)}
            placeholder="024xxxxxxx"
            required
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.submitBtn} type="submit" disabled={submitting}>
          {submitting ? 'Publishing…' : 'Publish fundraiser'}
        </button>
      </form>
    </main>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 24, marginBottom: 4 },
  sub: { color: '#666', marginBottom: 24 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600, width: '100%' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 15, fontWeight: 400, boxSizing: 'border-box' },
  calcBox: { background: '#f4f9f4', border: '1px solid #cfe8cf', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  toggleBtn: {
    flex: '1 1 auto',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #cfe8cf',
    background: '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#2a6b2a',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  toggleBtnActive: { background: '#1a7d3c', color: '#fff', borderColor: '#1a7d3c' },
  calcNote: { fontSize: 14, color: '#2a6b2a', margin: 0 },
  error: { color: '#c0392b', fontSize: 14 },
  submitBtn: {
    padding: '14px 20px',
    borderRadius: 10,
    border: 'none',
    background: '#1a7d3c',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
