'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { nanoid } from 'nanoid';
import * as tus from 'tus-js-client';

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

export default function CreateCampaign() {
  const router = useRouter();

  // Sign-in gate: creators authenticate with just their email (magic link,
  // no password) before they can publish. Their email becomes the account
  // identity; the "name" they type separately is specifically their MoMo
  // account name, since that's what actually needs to match for payout.
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [authEmail, setAuthEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSendMagicLink(e) {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
      });
      if (otpError) throw otpError;
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message || 'Could not send sign-in link. Try again.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState('emergency');
  const [videoFile, setVideoFile] = useState(null);
  const [suggestedAmount, setSuggestedAmount] = useState(2);
  const [targetAmount, setTargetAmount] = useState(8000);

  const [creatorName, setCreatorName] = useState(''); // this is now specifically their MoMo account name
  const [momoNumber, setMomoNumber] = useState('');

  // Video uploads the instant it's selected, in the background, using a
  // resumable (TUS) upload — so if it fails partway (dropped connection,
  // backgrounded app), tapping Retry continues from the last uploaded
  // chunk instead of re-sending the whole file from zero.
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoStage, setVideoStage] = useState('idle'); // idle | uploading | done | error
  const [uploadProgress, setUploadProgress] = useState(0);
  const tusUploadRef = useRef(null); // the in-progress/resumable tus.Upload instance
  const uploadCallbacksRef = useRef({ resolve: null, reject: null }); // rebindable per attempt

  const [stage, setStage] = useState('idle'); // idle | waiting-for-video | publishing
  const [error, setError] = useState('');

  const suggested = Number(suggestedAmount) || 0;
  const target = Number(targetAmount) || 0;

  // Number of people is always the calculated result — never a separate
  // manual input — so it stays in sync automatically whenever either the
  // suggested amount or the target amount changes.
  const derivedPeople = useMemo(() => {
    if (!suggested) return 0;
    return Math.ceil(target / suggested);
  }, [target, suggested]);

  // Starts a fresh resumable upload for a newly-selected file. Returns the
  // promise handleSubmit can await if the upload is still running when the
  // creator taps Publish.
  function startUpload(file) {
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const fileName = `${nanoid()}-${file.name}`.replace(/\s+/g, '-');

    setVideoUrl(null);
    setVideoStage('uploading');
    setUploadProgress(0);

    const promise = new Promise((resolve, reject) => {
      uploadCallbacksRef.current = { resolve, reject };
    });

    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000], // built-in auto-retry on transient blips
      chunkSize: 6 * 1024 * 1024, // 6MB — Supabase's recommended chunk size for resumable uploads
      headers: {
        authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      metadata: {
        bucketName: 'campaign-videos',
        objectName: fileName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => {
        const publicUrl = `${projectUrl}/storage/v1/object/public/campaign-videos/${encodeURIComponent(fileName)}`;
        setVideoUrl(publicUrl);
        setVideoStage('done');
        uploadCallbacksRef.current.resolve(publicUrl);
      },
      onError: (err) => {
        setVideoStage('error');
        setError('Video upload failed. Tap Retry to continue from where it stopped.');
        uploadCallbacksRef.current.reject(err);
      },
    });

    tusUploadRef.current = upload;
    upload.start();

    return promise;
  }

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
    startUpload(file);
  }

  function handleRetryUpload() {
    setError('');
    // If the same tus.Upload instance is still around, calling start() on
    // it resumes from the last acknowledged byte (a HEAD request checks
    // how much the server already has) rather than starting over.
    if (tusUploadRef.current) {
      setVideoStage('uploading');
      const promise = new Promise((resolve, reject) => {
        uploadCallbacksRef.current = { resolve, reject };
      });
      tusUploadRef.current.start();
      return promise;
    } else if (videoFile) {
      return startUpload(videoFile);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      let finalVideoUrl = videoUrl;

      if (videoFile && videoStage === 'uploading') {
        setStage('waiting-for-video');
        finalVideoUrl = await new Promise((resolve, reject) => {
          uploadCallbacksRef.current = { resolve, reject };
        });
      } else if (videoFile && videoStage === 'error') {
        setError('The video failed to upload. Tap Retry on the video before publishing.');
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
        creator_email: session?.user?.email || null,
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

  // Still checking for an existing session
  if (session === undefined) {
    return (
      <main style={styles.page}>
        <h1 style={styles.h1}>Start a fundraiser</h1>
        <p style={styles.sub}>Loading…</p>
      </main>
    );
  }

  // Not signed in — show the email sign-in gate instead of the form
  if (session === null) {
    return (
      <main style={styles.page}>
        <h1 style={styles.h1}>Start a fundraiser</h1>
        <p style={styles.sub}>Sign in with your email to get started — no password needed.</p>

        {!otpSent ? (
          <form onSubmit={handleSendMagicLink} style={styles.form}>
            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            {authError && <p style={styles.error}>{authError}</p>}
            <button style={styles.submitBtn} type="submit" disabled={authSubmitting}>
              {authSubmitting ? 'Sending…' : 'Send me a sign-in link'}
            </button>
          </form>
        ) : (
          <div style={styles.calcBox}>
            <p style={{ margin: 0, fontSize: 14, color: '#2a6b2a' }}>
              Check <strong>{authEmail}</strong> for a sign-in link. Tap it on this device to continue.
            </p>
          </div>
        )}
      </main>
    );
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
              {videoStage === 'error' ? (
                <button type="button" style={styles.retryBtn} onClick={handleRetryUpload}>
                  Retry
                </button>
              ) : (
                <span style={styles.videoStatusBadge(videoStage)}>
                  {videoStage === 'uploading' && `${uploadProgress}%`}
                  {videoStage === 'done' && 'Uploaded'}
                </span>
              )}
            </div>
            {videoStage === 'uploading' && (
              <>
                <div style={styles.progressBarBg}>
                  <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }} />
                </div>
                <div style={styles.uploadingLabel}>Uploading in the background… {uploadProgress}%</div>
              </>
            )}
            {videoStage === 'error' && (
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%`, background: '#c0392b' }} />
              </div>
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

          <div style={styles.peopleDisplay}>
            <span style={styles.peopleLabel}>Number of people needed</span>
            <span style={styles.peopleValue}>{derivedPeople.toLocaleString()}</span>
          </div>

          <p style={styles.calcNote}>
            Needs about <strong>{derivedPeople.toLocaleString()}</strong> people giving ₵{suggested.toFixed(2)} each to reach <strong>₵{target.toLocaleString()}</strong>
          </p>
        </div>

        <label style={styles.label}>
          Name on your MoMo account
          <input
            style={styles.input}
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="Exactly as it appears on MoMo"
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

        <p style={styles.signedInAs}>
          Signed in as {session.user.email} ·{' '}
          <button type="button" style={styles.signOutLink} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          {' '}· <Link href="/my-fundraisers" style={styles.signOutLink}>My fundraisers</Link>
        </p>

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
  retryBtn: {
    fontSize: 12.5,
    fontWeight: 700,
    padding: '6px 14px',
    borderRadius: 999,
    border: 'none',
    background: '#c0392b',
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
  },
  progressBarBg: { background: '#eee', borderRadius: 999, height: 8, overflow: 'hidden' },
  progressBarFill: { background: '#1a7d3c', height: '100%', transition: 'width 0.2s' },
  calcBox: { background: '#f4f9f4', border: '1px solid #cfe8cf', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 },
  peopleDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #cfe8cf',
    borderRadius: 8,
    padding: '10px 14px',
  },
  peopleLabel: { fontSize: 13, color: '#3a6b4a', fontWeight: 600 },
  peopleValue: { fontSize: 18, color: '#1a7d3c', fontWeight: 700 },
  calcNote: { fontSize: 14, color: '#2a6b2a', margin: 0 },
  signedInAs: { fontSize: 12.5, color: '#888', textAlign: 'center', margin: 0 },
  signOutLink: { background: 'none', border: 'none', color: '#1a7d3c', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' },
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
