// InfoHoverVideo.js
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Clock, Play, X } from "lucide-react";
import { Button } from "./ui/button";
import video_calalog from "../data/videoDetails.json";

/* ------------------ Video Catalog ------------------ */
export const VIDEO_CATALOG = video_calalog;

/* ------------------ helpers ------------------ */
const extractYouTubeId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
      return u.searchParams.get("v");
    }
  } catch {}
  const m = String(url).match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/
  );
  return m?.[1] || null;
};

const toEmbed = (id) =>
  id
    ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`
    : "";

const metaCache = new Map();

/* ------------------ Fullscreen modal ------------------ */
const FullScreenVideo = ({ embedUrl, onClose, open, returnFocusTo }) => {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlayRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      requestAnimationFrame(() => returnFocusTo?.current?.focus?.());
    };
  }, [open, onClose, returnFocusTo]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99909] bg-black/80 backdrop-blur-sm flex items-center justify-center outline-none"
      onClick={onClose}
    >
      <div
        className="relative w-[min(92vw,1200px)] aspect-video rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          title="Demo Video"
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-2 bg-black/60 hover:bg-black/70 text-white transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body
  );
};

/* ------------------ Main component ------------------ */
const InfoHoverVideo = ({
  videoId,
  catalog = VIDEO_CATALOG,
  fixedTopRight = false,
  disablePreviewOnTouch = true,
}) => {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [thumb, setThumb] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const triggerRef = useRef(null);

  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0, width: 320 });

  // graceful close timer for portal hover
  const closeTimer = useRef();
  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const scheduleClose = useCallback(
    (delay = 160) => {
      cancelClose();
      closeTimer.current = setTimeout(() => setHoverOpen(false), delay);
    },
    [cancelClose]
  );
  useEffect(() => () => cancelClose(), [cancelClose]);

  // detect touch
  const isTouch = useMemo(
    () =>
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    []
  );
  const shouldShowHover = !(disablePreviewOnTouch && isTouch);

  const selected = catalog?.[videoId];
  const effectiveUrl = selected?.link || "";
  const catalogTitle = selected?.name;
  const ctaText = (selected?.buttonText).trim(); // <-- NEW: CTA text from JSON

  const ytId = useMemo(() => extractYouTubeId(effectiveUrl), [effectiveUrl]);
  const embedUrl = useMemo(() => toEmbed(ytId), [ytId]);

  useEffect(() => {
    let abort = false;
    if (!ytId) return;
    setLoading(true);

    const fallbackThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

    const prefetch = (url) => {
      const img = new Image();
      img.src = url;
    };

    if (metaCache.has(ytId)) {
      const cached = metaCache.get(ytId);
      setThumb(cached.thumb || fallbackThumb);
      setTitle(cached.title || catalogTitle);
      setLoading(false);
      prefetch(cached.thumb || fallbackThumb);
      return;
    }

    const setFallback = () => {
      if (!abort) {
        metaCache.set(ytId, { thumb: fallbackThumb, title: catalogTitle });
        setThumb(fallbackThumb);
        setTitle(catalogTitle);
        setLoading(false);
        prefetch(fallbackThumb);
      }
    };

    if (!API_KEY) {
      setFallback();
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${ytId}&key=${API_KEY}&part=snippet`
        );
        const data = await res.json();
        const item = data?.items?.[0]?.snippet;
        const bestThumb =
          item?.thumbnails?.maxres?.url ||
          item?.thumbnails?.standard?.url ||
          item?.thumbnails?.high?.url ||
          fallbackThumb;

        if (!abort) {
          metaCache.set(ytId, {
            thumb: bestThumb,
            title: item?.title || catalogTitle,
          });
          setThumb(bestThumb);
          setTitle(item?.title || catalogTitle);
          setLoading(false);
          prefetch(bestThumb);
        }
      } catch {
        setFallback();
      }
    })();

    return () => {
      abort = true;
    };
  }, [ytId, catalogTitle]);

  const positionPreview = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 320;
    const gap = 10;
    let left = r.right - width;
    let top = r.bottom + gap;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left < 8) left = 8;
    if (left + width > vw - 8) left = vw - width - 8;
    const approxH = 200;
    if (top + approxH > vh) top = Math.max(8, r.top - approxH - gap);

    setPreviewPos({ top, left, width });
  }, []);

  const openHover = useCallback(() => {
    if (!shouldShowHover) return;
    positionPreview();
    cancelClose();
    setHoverOpen(true);
  }, [shouldShowHover, positionPreview, cancelClose]);

  useEffect(() => {
    if (!hoverOpen) return;
    const onScrollOrResize = () => positionPreview();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [hoverOpen, positionPreview]);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const containerClass = fixedTopRight
    ? "fixed top-4 right-4 z-50"
    : "relative z-40";
  if (!effectiveUrl || !ytId) return null;

  return (
    <div
      className={`${containerClass} group`}
      style={{ display: "inline-block" }}
    >
      {/* Trigger (icon + text from catalog.buttonText) */}
      <Button
        ref={triggerRef}
        aria-label={ctaText}
        title={ctaText}
        onMouseEnter={openHover}
        onMouseLeave={() => scheduleClose(160)}
        onFocus={openHover}
        onBlur={() => scheduleClose(120)}
        onClick={openModal}
        className="group relative inline-flex items-center gap-2 rounded-full px-4 py-2
             text-white font-semibold transition-all duration-300
             hover:scale-[1.03] hover:shadow-[0_0_12px_rgba(255,255,255,0.25)]
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50
             border border-white/20 backdrop-blur-md overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #4080c0ff 0%, #0057b3bf 100%),
                 radial-gradient(circle at top right, rgba( 0,150, 255, 0.3) 0%, transparent 70%),
    radial-gradient(circle at bottom left, rgba(0, 80, 170, 0.3) 0%, transparent 70%),
    radial-gradient(circle at center, rgba(0, 150, 255, 0.1) 0%, transparent 50%)`,
          boxShadow: "0 8px 32px rgba(0, 51, 102, 0.25)",
        }}
      >
        <Play className="h-4 w-4 text-white" />
        <span className="truncate">{ctaText}</span>
      </Button>

      {/* Hover card (PORTALED) */}
      {hoverOpen &&
        createPortal(
          <div
            className="fixed z-[9998]"
            style={{
              top: previewPos.top,
              left: previewPos.left,
              width: previewPos.width,
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={() => scheduleClose(140)}
          >
            <div className="relative origin-top-right rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-black/5 overflow-hidden">
              {/* arrow */}
              <div className="absolute -top-2 right-4 h-3 w-3 rotate-45 bg-white dark:bg-slate-900 border-l border-t border-slate-200/60 dark:border-slate-800" />
              <div className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-2">
                  Preview
                </p>

                <div
                  className="relative rounded-xl overflow-hidden ring-1 ring-black/5 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                  onClick={openModal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && openModal()}
                >
                  {loading ? (
                    <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-700" />
                  ) : (
                    <img
                      src={thumb}
                      alt={title || catalogTitle}
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* <div className="rounded-full bg-white/95 dark:bg-black/60 backdrop-blur px-4 py-2 flex items-center gap-2 shadow-lg border border-white/70 dark:border-white/10">
                      <Play className="h-4 w-4" />
                      <span className="text-sm font-semibold">Play</span>
                    </div> */}
                  </div>
                </div>

                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                  {catalogTitle}
                </p>

                <div className="mt-3">
                  {/* CTA inside preview uses the SAME catalog buttonText */}
                  <Button
                    onClick={openModal}
                    aria-label={ctaText}
                    title={ctaText}
                    className="group relative inline-flex items-center gap-2 rounded-full px-4 py-2
             text-white font-semibold transition-all duration-300
             hover:scale-[1.03] hover:shadow-[0_0_12px_rgba(255,255,255,0.25)]
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50
             border border-white/20 backdrop-blur-md overflow-hidden w-full"
                    style={{
                      background: `linear-gradient(135deg, #4080c0ff 0%, #0057b3bf 100%),
                 radial-gradient(circle at top right, rgba( 0,150, 255, 0.3) 0%, transparent 70%),
    radial-gradient(circle at bottom left, rgba(0, 80, 170, 0.3) 0%, transparent 70%),
    radial-gradient(circle at center, rgba(0, 150, 255, 0.1) 0%, transparent 50%)`,
                      boxShadow: "0 8px 32px rgba(0, 51, 102, 0.25)",
                    }}
                  >
                    <Play />
                    <span className="relative z-10 text-sm font-semibold truncate">
                      {/* {ctaText} */}
                      Play
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <FullScreenVideo
        embedUrl={embedUrl}
        open={modalOpen}
        onClose={closeModal}
        returnFocusTo={triggerRef}
      />

      <style>{`
        @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};

export default InfoHoverVideo;
