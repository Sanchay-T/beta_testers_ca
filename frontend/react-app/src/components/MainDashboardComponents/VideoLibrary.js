              
import React, { useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clock, Info, Play, X } from "lucide-react";
import { Button } from "../ui/button";
import video_calalog from "../../data/videoDetails.json";
export const VIDEO_CATALOG = video_calalog;

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
  const m = String(url).match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/);
  return m?.[1] || null;
};

const toEmbed = (id) =>
  id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1` : "";

const metaCache = new Map();

const FullScreenVideo = ({ embedUrl, onClose, open, returnFocusTo }) => {
  const overlayRef = useRef(null);

  React.useEffect(() => {
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

const VideoCard = ({ videoId, catalog = VIDEO_CATALOG }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [thumb, setThumb] = useState("");
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(true);
    const triggerRef = useRef(null);

    const selected = catalog?.[videoId];
    const effectiveUrl = selected?.link || "";
    const catalogTitle = selected?.name || "";

    const ytId = useMemo(() => extractYouTubeId(effectiveUrl), [effectiveUrl]);
    const embedUrl = useMemo(() => toEmbed(ytId), [ytId]);

    React.useEffect(() => {
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
            setTitle(cached.title || "");
            setLoading(false);
            prefetch(cached.thumb || fallbackThumb);
            return;
        }

        const setFallback = () => {
            if (!abort) {
                metaCache.set(ytId, { thumb: fallbackThumb, title: "" });
                setThumb(fallbackThumb);
                setTitle("");
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
                    metaCache.set(ytId, { thumb: bestThumb, title: item?.title || "" });
                    setThumb(bestThumb);
                    setTitle(item?.title || "");
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

    const openModal = useCallback(() => setModalOpen(true), []);
    const closeModal = useCallback(() => setModalOpen(false), []);

    return (
        <div className="group" style={{ display: "inline-block" }}>
            <div
                className="relative rounded-xl overflow-hidden ring-1 ring-black/5 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                onClick={openModal}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && openModal()}
                ref={triggerRef}
            >
                {loading ? (
                    <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-700" />
                ) : (
                    <img src={thumb} alt={title || catalogTitle} className="aspect-video w-full object-cover" />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-white/95 dark:bg-black/60 backdrop-blur px-4 py-2 flex items-center gap-2 shadow-lg border border-white/70 dark:border-white/10">
                        <Play className="h-4 w-4" />
                        <span className="text-sm font-semibold">Play</span>
                    </div>
                </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                {title || catalogTitle}
            </p>
            <FullScreenVideo embedUrl={embedUrl} open={modalOpen} onClose={closeModal} returnFocusTo={triggerRef} />
        </div>
    );
};


const VideoLibrary = () => {
    const videoIds = Object.keys(VIDEO_CATALOG);

    console.log("Video IDs:", videoIds); // Debugging line to check video IDs

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Video Library</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videoIds.map(videoId => (
                    <VideoCard key={videoId} videoId={videoId} />
                ))}
            </div>
        </div>
    );
};

export default VideoLibrary;
