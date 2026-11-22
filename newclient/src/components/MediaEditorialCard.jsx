// src/components/MediaEditorialCard.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Film, Clapperboard, Mic, Tv, FileText, ArrowRight } from 'lucide-react';
import { BRONZE_COLOR, LIGHT_BRONZE_COLOR } from './themeconstants';

function resolveThumbnailUrl(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    return `https://image.tmdb.org/t/p/w342${trimmed}`;
  }
  if (trimmed.startsWith('http://books.google.com')) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  return trimmed;
}

function getFallbackMeta(workType) {
  switch (workType) {
    case 'BOOK':
      return {
        Icon: BookOpen,
        label: 'Book',
        gradient: 'from-[#5e462d] to-[#1f170f]',
        aspect: 'aspect-[2/3]',
      };
    case 'FILM':
      return {
        Icon: Film,
        label: 'Film',
        gradient: 'from-[#5a2b2b] to-[#1a0d0d]',
        aspect: 'aspect-[2/3]',
      };
    case 'DOCUMENTARY':
    case 'DOCUSERIES':
      return {
        Icon: Clapperboard,
        label: workType === 'DOCUSERIES' ? 'Docuseries' : 'Documentary',
        gradient: 'from-[#284a4e] to-[#0f1c1e]',
        aspect: 'aspect-[2/3]',
      };
    case 'PODCAST_SERIES':
      return {
        Icon: Mic,
        label: 'Podcast',
        gradient: 'from-[#36335c] to-[#131224]',
        aspect: 'aspect-square',
      };
    case 'TV_SERIES':
      return {
        Icon: Tv,
        label: 'TV Series',
        gradient: 'from-[#4d2f4b] to-[#1b101a]',
        aspect: 'aspect-[2/3]',
      };
    default:
      return {
        Icon: FileText,
        label: 'Media',
        gradient: 'from-[#3f3a36] to-[#171514]',
        aspect: 'aspect-[2/3]',
      };
  }
}

function getCreatorPrefix(workType) {
  switch (workType) {
    case 'BOOK':
      return 'by';
    case 'PODCAST_SERIES':
      return 'Hosted by';
    case 'FILM':
    case 'DOCUMENTARY':
    case 'DOCUSERIES':
      return 'Directed by';
    default:
      return 'by';
  }
}

function MediaEditorialCard({ result }) {
  const [imgFailed, setImgFailed] = useState(false);
  const thumbUrl = resolveThumbnailUrl(result.imagePath);
  const { Icon, label, gradient, aspect } = getFallbackMeta(result.workType);
  const factors = Array.isArray(result.contributingFactors) ? result.contributingFactors : [];
  const linkedCases = typeof result.linkedCasesCount === 'number' ? result.linkedCasesCount : 0;

  return (
    <Link
      to={result.path}
      className="group rounded-xl bg-gray-900/90 border border-gray-800 hover:border-[#af7a56] p-4 flex gap-4 items-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(175,122,86,0.45)]"
    >
      {/* Thumbnail Cover / Poster */}
      <div
        className={`w-24 sm:w-28 ${aspect} shrink-0 rounded-md overflow-hidden border border-gray-700/80 shadow-lg bg-gradient-to-br ${gradient} relative flex items-center justify-center`}
      >
        {thumbUrl && !imgFailed ? (
          <img
            src={thumbUrl}
            alt={`${result.name} cover`}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full p-2.5 flex flex-col items-center justify-between text-center border-l-4 border-black/30">
            <span className="text-[10px] uppercase tracking-widest text-[#edc4a3]/80 font-semibold">
              {label}
            </span>
            <div className="flex flex-col items-center gap-1.5 my-auto">
              <Icon className="w-6 h-6 text-[#edc4a3]/80" />
              <span className="text-[11px] font-serif font-semibold text-gray-100 leading-tight line-clamp-3">
                {result.name}
              </span>
            </div>
            <span className="text-[9px] tracking-widest uppercase text-gray-400">
              Innocence Archive
            </span>
          </div>
        )}
      </div>

      {/* Editorial Content */}
      <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch">
        <div>
          <h2
            className={`text-base sm:text-lg font-serif font-bold leading-snug ${LIGHT_BRONZE_COLOR} group-hover:underline line-clamp-2`}
          >
            {result.name}
          </h2>

          {result.creatorName && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {getCreatorPrefix(result.workType)}{' '}
              <span className="text-gray-200 font-medium">{result.creatorName}</span>
            </p>
          )}

          {result.detail && (
            <p className="text-xs sm:text-sm text-gray-300/90 mt-2.5 leading-relaxed line-clamp-3">
              {result.detail}
            </p>
          )}
        </div>

        {/* Bottom Row: Factor Pills + Linked Cases Count */}
        <div className="mt-3.5 pt-2.5 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {factors.slice(0, 2).map((factor) => (
              <span
                key={factor.id || factor.code || factor.name}
                className="px-2 py-0.5 rounded-full text-[11px] bg-black/60 border border-[#af7a56]/45 text-gray-200 truncate max-w-[180px]"
              >
                {factor.name}
              </span>
            ))}
            {factors.length > 2 && (
              <span className="px-1.5 py-0.5 text-[11px] text-gray-400">
                +{factors.length - 2}
              </span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${BRONZE_COLOR} whitespace-nowrap ml-auto`}
          >
            {linkedCases > 0
              ? `${linkedCases} Linked ${linkedCases === 1 ? 'Case' : 'Cases'}`
              : 'Explore'}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default MediaEditorialCard;
