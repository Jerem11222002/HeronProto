import React from 'react';
import PreviewTile from './PreviewTile';
import { Link } from 'react-router-dom';

const EventPreview = ({ featured = [], variant = 'strip', onItemClick = () => {} }) => {
  if (variant === 'vertical') {
    return (
      <div className="featuredPreview recentList" aria-label="Recent events preview">
        {featured.slice(0,3).map((f, i) => {
          const idOrSlug = f.slug || f._id || f.id;
          const imgSrc = f.img || f.image || (f.media && f.media[0]) || '';
          const href = idOrSlug ? `/events/${idOrSlug}` : '/events';
          return (
            <Link
              key={idOrSlug || f.title}
              to={href}
              className="recentItem animateTile"
              aria-label={`Open event ${f.title}`}
              onClick={() => onItemClick({ title: f.title, slug: idOrSlug })}
            >
              <PreviewTile title={f.title} src={imgSrc} variant="small" />
              <div className="recentMeta">
                <div className="recentTitle">{f.title}</div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  // fallback strip
  return (
    <div className="featuredPreview previewStrip" aria-label="Featured events preview">
      {featured.map((f) => {
        const idOrSlug = f.slug || f._id || f.id;
        const imgSrc = f.img || f.image || (f.media && f.media[0]) || '';
        const href = idOrSlug ? `/events/${idOrSlug}` : '/events';
        return (
          <a
            key={idOrSlug || f.title}
            href={href}
            className="previewTile animateTile"
            aria-label={`Open event ${f.title}`}
            onClick={() => onItemClick({ title: f.title, slug: idOrSlug })}
          >
            <PreviewTile title={f.title} src={imgSrc} />
            <div className="tileOverlay">
              <div className="tileTitle">{f.title}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default EventPreview;
