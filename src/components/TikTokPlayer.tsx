import React from 'react';
import { ExternalLink } from 'lucide-react';

interface TikTokPlayerProps {
  videoId: string;
  videoUrl?: string;
  title?: string;
  isActive?: boolean;
  onPlay?: () => void;
  containerClassName?: string;
}

export const TikTokPlayer: React.FC<TikTokPlayerProps> = ({
  videoId,
  videoUrl,
  title,
  containerClassName = "w-full h-full relative overflow-hidden bg-black"
}) => {
  const cleanUrl = videoUrl?.split('?')[0] || '';
  const rawVideoId = videoId || cleanUrl.split('/').pop() || '';
  const watchUrl = `https://www.tiktok.com/video/${rawVideoId}`;

  return (
    <div className={containerClassName}>
      <div className="w-full h-full relative bg-black">
        <iframe
          src={`https://www.tiktok.com/embed/v2/${rawVideoId}`}
          title={title || "TikTok Video"}
          className="w-full h-full border-0 transform scale-[0.98] origin-top"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <div className="absolute bottom-2 right-2 z-10">
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 bg-black/70 hover:bg-black text-white text-[9px] font-black uppercase tracking-wider rounded-md backdrop-blur-sm flex items-center gap-1 transition-colors shadow-sm"
          >
            <span>Watch on TikTok</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
