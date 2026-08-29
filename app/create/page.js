'use client';

import { useState, useMemo, useRef } from 'react';
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

const MAX_VIDEO_MB = 50; // Supabase free-tier default per-file limit

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

// Uploads directly to Supabase Storage's REST endpoint (instead of the
// supabase-js helper) so we get real upload progress events — the
// supabase-js client doesn't expose progress, which is why publishing
// looked frozen on slow mobile uploads with no feedback.
function uploadVideoWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const fileName = `${nanoid()}-${file.name}`.replace(/\s+/g, '-');
    const uploadUrl = `${projectUrl}/storage/v1/object/campaign-videos/${encodeURIComponent(fileName)}`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.timeout = 120000; // 2 minutes — fail loudly instead of hanging forever

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${projectUrl}/storage/v1/object/public/campaign-videos/${encodeURIComponent(fileName)}`;
        resolve(publicUrl);
      } else {
        reject(new Error(`Video upload failed (${xhr.status}). Try a smaller file or check your connection.`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during video upload. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Video upload timed out. Try a shorter clip or a stronger connection.'));

    xhr.send(file);
  });
}

export default function CreateCampaign() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState('emergency');
  const [videoFile, setVideoFile] = useState(null);
  const [suggestedAmount, setSuggestedAmount] = useState(2);

  const [goalMode, setGoalMode] = useState('amount'); // 'amount' | 'people'
  const [targetAmount, setTargetAmount] = useState(8000);
  const [targetPeople, setTargetPeople] = useState(4000);

  const [creatorName, setCreatorName] = useState('');
  const [momoNumber, setMomoNumber] = useState('');

  // Video uploads the instant it's selected, in the background, while the
  // creator keeps filling out the rest of the form — instead of waiting
  // until they tap Publish to even start.
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoStage, setVideoStage] = useState('idle'); // idle | uploading | done | error
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadPromiseRef = useRef(null);

  const [stage, setStage] = useState('idle'); // idle | waiting-for-video | publishing
  const [error, setError] = useState('');

  const suggested = Number(suggestedAmount) || 0;

  const derivedPeople = useMemo(() => {
    if (goalMode === 'people') return Number(targetPeople) || 0;
    if (!suggested) return 0;
    return Math.ceil((Number(targetAmount) || 0) / suggested);
  }, [goalMode, targetPeople, targetAmount, suggested]);

  const derivedTotal = useMemo(() => {
    if (goalMode === 'amount') return Number(targetAmount) || 0;
    return suggested * (Number(targetPeople) || 0);
  }, [goalMode, targetAmount, targetPeople, suggested]);

  function handleVideoChange(e) {
    const file = e.target.files?.[0] || null;
    setError('');
    if (!file) return;

    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`That video is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Keep it under ${MAX_VIDEO_MB}MB — try a shorter clip.`);
      setVideoFile(null);
      e.target.value = '';
      return;
    }

    setVideoFile(file);
    setVideoUrl(null);
    setVideoStage('uploading');
    setUploadProgress(0);

    const promise = uploadVideoWithProgress(file, setUploadProgress)
      .then((url) => {
        setVideoUrl(url);
        setVideoStage('done');
        return url;
      })
      .catch((err) => {
        setVideoStage('error');
        setError(err.message || 'Video upload failed.');
        throw err;
      });

    uploadPromiseRef.current = promise;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      let finalVideoUrl = videoUrl;

      // If a video was picked but hasn't finished uploading yet, wait for
      // the upload already in progress rather than starting a new one.
      if (videoFile && videoStage === 'uploading' && uploadPromiseRef.current) {
        setStage('waiting-for-video');
        finalVideoUrl = await uploadPromiseRef.current;
      } else if (videoFile && videoStage === 'error') {
        setError('The video failed to upload. Try reselecting it before publishing.');
        return;
      }

      setStage('publishing');

      const slug = `${slugify(title)}-${nanoid(5)}`;
      const targetUnits = derivedPeople;

      const { error: insertError } = await supabase.from('campaigns').insert({
        slug,
        title,
        story,
        category,
        video_url: finalVideoUrl,
        suggested_amount: suggested,
        target_units: targetUnits,
        creator_name: creatorName,
        creator_momo_number: momoNumber,
      });

      if (insertError) throw insertError;

      router.push(`/create/success?slug=${slug}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      setStage('idle');
    }
  }

  const submitting = stage !== 'idle';
  let buttonLabel = 'Publish fundraiser';
  if (stage === 'waiting-for-video') buttonLabel = `Finishing video upload… ${uploadProgress}%`;
  if (stage === 'publishing') buttonLabel = 'Creating your page…';

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
          Video (shown first, autoplays muted) — max {MAX_VIDEO_MB}MB
          <input
            style={styles.input}
            type="file"
            accept="video/*"
            onChange={handleVideoChange}
          />
        </label>

        {videoFile && (
          <div style={styles.videoCard}>
            <div style={styles.videoCardTop}>
              <span style={styles.videoIcon}>{videoStage === 'done' ? '✅' : videoStage === 'error' ? '⚠️' : '🎥'}</span>
              <div style={styles.videoInfo}>
                <div style={styles.videoName}>{videoFile.name}</div>
                <div style={styles.videoMeta}>{(videoFile.size / 1024 / 1024).toFixed(1)}MB</div>
              </div>
              <span style={styles.videoStatusBadge(videoStage)}>
                {videoStage === 'uploading' && `${uploadProgress}%`}
                {videoStage === 'done' && 'Uploaded'}
                {videoStage === 'error' && 'Failed'}
              </span>
            </div>
            {videoStage === 'uploading' && (
              <>
                <div style={styles.progressBarBg}>
                  <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }} />
                </div>
                <div style={styles.uploadingLabel}>Uploading in the background… {uploadProgress}%</div>
              </>
            )}
          </div>
        )}

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
          {buttonLabel}
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
  fileNote: { fontSize: 12.5, color: '#666', fontWeight: 400 },
  videoCard: {
    background: '#fff',
    border: '1.5px solid #e0e0e0',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  videoCardTop: { display: 'flex', alignItems: 'center', gap: 12 },
  videoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: '#f4f9f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  videoInfo: { flex: 1, minWidth: 0 },
  videoName: { fontSize: 13.5, fontWeight: 600, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  videoMeta: { fontSize: 12, color: '#888', fontWeight: 400 },
  videoStatusBadge: (videoStage) => ({
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
    background: videoStage === 'uploading' ? '#fff4e0' : videoStage === 'error' ? '#fdecea' : '#e8f5ea',
    color: videoStage === 'uploading' ? '#b5750a' : videoStage === 'error' ? '#c0392b' : '#1a7d3c',
    flexShrink: 0,
  }),
  uploadingLabel: { fontSize: 12.5, color: '#b5750a', fontWeight: 600 },
  progressBarBg: { background: '#eee', borderRadius: 999, height: 8, overflow: 'hidden' },
  progressBarFill: { background: '#1a7d3c', height: '100%', transition: 'width 0.2s' },
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
