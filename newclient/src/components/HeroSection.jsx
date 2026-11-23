// src/components/HeroSection.jsx
// Option A — 3-Column Editorial Hero:
// Left: Display Title + Search Bar + Compact Browse Chips
// Center: Innocence Archive Hero Crest
// Right: Prominent Live "Recent News" Rail linked to /news

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Film as FilmIcon,
  Mic,
  Newspaper,
  ExternalLink,
  Megaphone,
  ArrowRight,
  User,
} from 'lucide-react';
import apiClient from '../apiClient';
import { BRONZE_COLOR, BRONZE_BORDER, LIGHT_BRONZE_COLOR } from './themeconstants';
import { getNewsCategoryMeta, formatNewsDate, getMediaWorkPath } from './newsConstants';
import Logo from '../assets/current_logo.png';

const HeroSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [scopeStats, setScopeStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    apiClient
      .get('/news/homepage?limit=4')
      .then((res) => {
        if (active) setNewsItems(res.data?.items || []);
      })
      .catch((err) => {
        console.error('HeroSection: Failed to fetch homepage news:', err);
      })
      .finally(() => {
        if (active) setNewsLoading(false);
      });

    apiClient
      .get('/homepage/stats')
      .then((res) => {
        if (active) setScopeStats(res.data || null);
      })
      .catch((err) => {
        console.error('HeroSection: Failed to fetch homepage stats:', err);
      });

    return () => {
      active = false;
    };
  }, []);

  const searchPlaceholder = scopeStats
    ? `Search ${scopeStats.publishedIndividuals.toLocaleString()} individuals, ${(scopeStats.mediaItems || scopeStats.mediaWorks || 0).toLocaleString()} media items...`
    : 'Search individuals, books, films...';

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const browseLinks = [
    { name: 'Books', icon: BookOpen, to: '/search?type=BOOK' },
    { name: 'Films', icon: FilmIcon, to: '/search?type=FILM' },
    { name: 'Podcasts', icon: Mic, to: '/search?type=PODCAST_SERIES' },
    { name: 'News Hub', icon: Newspaper, to: '/news' },
  ];

  const leadStory = newsItems[0] || null;
  const secondaryStories = newsItems.slice(1);

  return (
    <section className="w-full bg-black px-4 md:px-8 lg:px-12 py-12 md:py-16 lg:py-20 border-b border-[#af7a56]/25">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
        {/* LEFT COLUMN (4 cols): Title, Search, Compact Browse Chips */}
        <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1">
          <h1
            className={`text-3xl sm:text-4xl xl:text-[3.35rem] ${LIGHT_BRONZE_COLOR} font-serif uppercase mb-6`}
            style={{ lineHeight: '.92' }}
          >
            Stories <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;of the
            <br />
            &nbsp;Wrongfully
            <br />
            &nbsp;&nbsp;&nbsp;Convicted
          </h1>

          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className={`w-full max-w-md bg-black rounded-full p-2 flex items-center border-2 ${BRONZE_BORDER} relative ${scopeStats ? 'mb-2.5' : 'mb-5'}`}
          >
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className={`w-5 h-5 ${BRONZE_COLOR}`} />
            </span>
            <input
              type="search"
              placeholder={searchPlaceholder}
              aria-label="Search the Innocence Archive"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none pl-10 pr-4 py-1"
            />
            <button type="submit" className="hidden">
              Search
            </button>
          </form>

          {scopeStats && (
            <p className="w-full max-w-md text-[11px] text-gray-400 mb-5 px-2 leading-relaxed">
              <span className="text-gray-300 font-medium">
                {scopeStats.publishedIndividuals.toLocaleString()}
              </span>{' '}
              profiles ·{' '}
              <span className="text-gray-300 font-medium">
                {scopeStats.mediaWorks.toLocaleString()}
              </span>{' '}
              media works ·{' '}
              <span className="text-gray-300 font-medium">
                {scopeStats.newsArticles.toLocaleString()}
              </span>{' '}
              news articles
              {scopeStats.untoldStories > 0 && (
                <>
                  {' · '}
                  <Link
                    to="/untold-stories"
                    className="text-amber-400 hover:text-amber-300 hover:underline"
                  >
                    {scopeStats.untoldStories.toLocaleString()} untold stories →
                  </Link>
                </>
              )}
            </p>
          )}

          {/* Compact Browse Collection Pills */}
          <div className="w-full max-w-md">
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2.5 font-semibold">
              Browse Collections
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {browseLinks.map(({ name, icon: Icon, to }) => (
                <Link
                  key={name}
                  to={to}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-gray-900/90 hover:bg-gray-800 border border-[#af7a56]/35 hover:border-[#af7a56] transition-colors group"
                >
                  <Icon className={`w-4 h-4 ${BRONZE_COLOR} group-hover:text-[#edc4a3] shrink-0`} />
                  <span className="text-sm font-medium text-gray-200 group-hover:text-white">
                    {name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN (3 cols): Hero Crest Logo */}
        <div className="lg:col-span-3 flex justify-center items-center order-1 lg:order-2">
          <img
            src={Logo}
            alt="Innocence Archive Logo"
            className="max-h-[34vh] sm:max-h-[42vh] lg:max-h-[48vh] w-auto object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://placehold.co/280x360/000000/af7a56?text=Innocence+Archive';
            }}
          />
        </div>

        {/* RIGHT COLUMN (5 cols): Prominent Recent News Rail */}
        <div className="lg:col-span-5 order-3">
          <div className="rounded-xl border border-[#af7a56]/35 bg-gradient-to-b from-gray-900/95 to-gray-950 p-5 shadow-2xl">
            {/* Rail Header */}
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-[#af7a56]/25">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <h2 className={`text-sm font-bold uppercase tracking-widest ${LIGHT_BRONZE_COLOR}`}>
                  Recent News
                </h2>
              </div>
              <Link
                to="/news"
                className={`inline-flex items-center gap-1 text-xs font-semibold ${LIGHT_BRONZE_COLOR} hover:text-white transition-colors`}
              >
                News Hub <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {newsLoading ? (
              <div className="py-10 text-center text-xs text-gray-500">Loading latest news...</div>
            ) : !leadStory ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-gray-400">No news stories published yet.</p>
                <Link to="/news" className={`text-xs ${LIGHT_BRONZE_COLOR} hover:underline`}>
                  Visit News Hub →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Lead Story Card */}
                {(() => {
                  const cat = getNewsCategoryMeta(leadStory.category);
                  const dateLabel = formatNewsDate(leadStory.publishedAt || leadStory.createdAt);
                  const mediaPath = getMediaWorkPath(leadStory.mediaWork);
                  const isCta = leadStory.category === 'CALL_FOR_ACTION';
                  return (
                    <article
                      className={`rounded-lg p-3.5 border-l-4 ${
                        isCta
                          ? 'bg-orange-950/25 border border-orange-500/40 border-l-orange-500'
                          : 'bg-[#af7a56]/10 border border-[#af7a56]/30 border-l-[#af7a56]'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400 mb-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cat.badgeClass}`}>
                          {isCta && <Megaphone className="w-3 h-3" />}
                          {cat.label}
                        </span>
                        {(leadStory.source?.name || leadStory.sourceName) && (
                          <span className="text-gray-300 font-medium">
                            {leadStory.source?.name || leadStory.sourceName}
                          </span>
                        )}
                        {dateLabel && <span>· {dateLabel}</span>}
                      </div>

                      {leadStory.url ? (
                        <a
                          href={leadStory.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block text-[15px] font-semibold text-white hover:text-[#edc4a3] leading-snug transition-colors"
                        >
                          {leadStory.headline}
                          <ExternalLink className="inline w-3.5 h-3.5 ml-1.5 text-gray-400 group-hover:text-[#edc4a3]" />
                        </a>
                      ) : mediaPath ? (
                        <Link
                          to={mediaPath}
                          className="block text-[15px] font-semibold text-white hover:text-[#edc4a3] leading-snug transition-colors"
                        >
                          {leadStory.headline}
                        </Link>
                      ) : (
                        <h3 className="text-[15px] font-semibold text-white leading-snug">
                          {leadStory.headline}
                        </h3>
                      )}

                      {leadStory.summary && (
                        <p className="text-xs text-gray-300 mt-1.5 line-clamp-2 leading-relaxed">
                          {leadStory.summary}
                        </p>
                      )}

                      <div className="flex items-center flex-wrap gap-2 mt-2.5">
                        {(leadStory.individuals || []).slice(0, 2).map((ind) => (
                          <Link
                            key={ind.id}
                            to={`/profile/${ind.id}`}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#af7a56]/15 border border-[#af7a56]/40 text-[#edc4a3] hover:bg-[#af7a56]/30 transition-colors"
                          >
                            <User className="w-3 h-3" />
                            {ind.firstName} {ind.lastName}
                          </Link>
                        ))}
                        {mediaPath && (
                          <Link
                            to={mediaPath}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-600/40 text-amber-300 hover:bg-amber-900/60 transition-colors"
                          >
                            {leadStory.mediaWork.title} →
                          </Link>
                        )}
                        {leadStory.actionUrl && (
                          <a
                            href={leadStory.actionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-orange-600 hover:bg-orange-500 text-white transition-colors"
                          >
                            <Megaphone className="w-3 h-3" />
                            {leadStory.actionLabel || 'Take Action'}
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })()}

                {/* Secondary News Rows */}
                {secondaryStories.length > 0 && (
                  <div className="divide-y divide-gray-800/80">
                    {secondaryStories.map((story) => {
                      const cat = getNewsCategoryMeta(story.category);
                      const dateLabel = formatNewsDate(story.publishedAt || story.createdAt);
                      const mediaPath = getMediaWorkPath(story.mediaWork);
                      const isCta = story.category === 'CALL_FOR_ACTION';
                      return (
                        <article key={story.id} className="py-2.5 first:pt-1 last:pb-0">
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 mb-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9.5px] font-bold uppercase tracking-wider ${cat.badgeClass}`}>
                              {isCta && <Megaphone className="w-2.5 h-2.5" />}
                              {cat.label}
                            </span>
                            {(story.source?.name || story.sourceName) && (
                              <span className="text-gray-400">
                                {story.source?.name || story.sourceName}
                              </span>
                            )}
                            {dateLabel && <span>· {dateLabel}</span>}
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            {story.url ? (
                              <a
                                href={story.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs sm:text-[13px] font-medium text-gray-200 hover:text-[#edc4a3] leading-snug line-clamp-2 transition-colors"
                              >
                                {story.headline}
                              </a>
                            ) : mediaPath ? (
                              <Link
                                to={mediaPath}
                                className="text-xs sm:text-[13px] font-medium text-gray-200 hover:text-[#edc4a3] leading-snug line-clamp-2 transition-colors"
                              >
                                {story.headline}
                              </Link>
                            ) : (
                              <span className="text-xs sm:text-[13px] font-medium text-gray-200 leading-snug line-clamp-2">
                                {story.headline}
                              </span>
                            )}

                            {story.actionUrl && (
                              <a
                                href={story.actionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white"
                              >
                                {story.actionLabel || 'Act'}
                              </a>
                            )}
                          </div>

                          {story.individuals?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {story.individuals.slice(0, 2).map((ind) => (
                                <Link
                                  key={ind.id}
                                  to={`/profile/${ind.id}`}
                                  className="text-[10.5px] text-[#edc4a3]/90 hover:text-[#edc4a3] hover:underline"
                                >
                                  {ind.firstName} {ind.lastName}
                                </Link>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
