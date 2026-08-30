'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, portraitHeight = '48vh' }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  // Detected from the video's real dimensions once metadata loads — lets
  // the player adapt to portrait/selfie footage instead of force-cropping
  // it into a fixed 16:9 box.
  const [nativeAspect, setNativeAspect] = useState(null);
  const hideTimerRef = useRef(null);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  useEffect(() => {
    scheduleHide();
    return () => clearTimeout(hideTimerRef.current);
  }, [scheduleHide]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
    setShowControls(true);
    scheduleHide();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
    setShowControls(true);
    scheduleHide();
  }

  function skipBack(e) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - 5);
    setShowControls(true);
    scheduleHide();
  }

  function handleSeek(e) {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
    setShowControls(true);
    scheduleHide();
  }

  function handleTap() {
    setShowControls((prev) => !prev);
    scheduleHide();
  }

  // Landscape (or square/near-square) plays full-bleed, matching the video's
  // own ratio. Portrait/selfie footage is capped in height and shown whole
  // (letterboxed) instead of being cropped by a fixed 16:9 box.
  const isPortrait = nativeAspect !== null && nativeAspect < 0.95;
  const wrapStyle = isPortrait
    ? { ...styles.wrap, aspectRatio: 'auto', height: portraitHeight, background: '#000' }
    : { ...styles.wrap, aspectRatio: nativeAspect ? String(nativeAspect) : '16/9' };
  const videoStyle = isPortrait
    ? { ...styles.video, objectFit: 'contain' }
    : styles.video;

  return (
    <div style={wrapStyle} onClick={handleTap}>
      <style>{`@keyframes vidfund-spin { to { transform: rotate(360deg); } }`}</style>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        style={videoStyle}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.target.duration);
          const { videoWidth, videoHeight } = e.target;
          if (videoWidth && videoHeight) setNativeAspect(videoWidth / videoHeight);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
      />

      {isBuffering && (
        <div style={styles.bufferingOverlay}>
          <div style={styles.spinner} />
        </div>
      )}

      <div style={{ ...styles.controlsOverlay, opacity: showControls ? 1 : 0 }}>
        {/* Center controls: skip-back and play/pause */}
        <div style={styles.centerRow}>
          <button style={styles.circleBtn} onClick={skipBack} aria-label="Back 5 seconds">
            <span style={styles.skipIcon}>⟲</span>
            <span style={styles.skipLabel}>5</span>
          </button>
          <button
            style={styles.playBtn}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
        </div>

        {/* Bottom bar: seek, time, mute */}
        <div style={styles.bottomBar} onClick={(e) => e.stopPropagation()}>
          <span style={styles.timeText}>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            style={styles.seekBar}
          />
          <span style={styles.timeText}>{formatTime(duration)}</span>
          <button style={styles.muteBtn} onClick={(e) => { e.stopPropagation(); toggleMute(); }} aria-label={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {isMuted && !showControls && (
        <div style={styles.mutedHint} onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
          🔇 Tap to unmute
        </div>
      )}
    </div>
  );
}

const styles = {
  bufferingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.15)',
    pointerEvents: 'none',
  },
  spinner: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
    animation: 'vidfund-spin 0.8s linear infinite',
  },
  wrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: '#000',
    borderRadius: 0,
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  controlsOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent 30%, transparent 70%, rgba(0,0,0,0.45))',
    transition: 'opacity 0.25s',
    pointerEvents: 'auto',
  },
  centerRow: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  circleBtn: {
    background: 'rgba(0,0,0,0.4)',
    border: 'none',
    color: '#fff',
    width: 42,
    height: 42,
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    cursor: 'pointer',
  },
  skipIcon: { fontSize: 16 },
  skipLabel: { fontSize: 9, marginTop: -2, fontWeight: 700 },
  playBtn: {
    background: 'rgba(0,0,0,0.4)',
    border: 'none',
    color: '#fff',
    width: 54,
    height: 54,
    borderRadius: '50%',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
  },
  timeText: { color: '#fff', fontSize: 11, fontFamily: 'monospace', minWidth: 32, textAlign: 'center' },
  seekBar: { flex: 1, accentColor: '#F2A93B', height: 3, cursor: 'pointer' },
  muteBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 4 },
  mutedHint: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: 999,
    cursor: 'pointer',
  },
};
