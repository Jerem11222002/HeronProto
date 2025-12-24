import React from 'react';

/**
 * Props:
 *  - title
 *  - src (base image url, expected to be from unsplash or similar supporting params)
 *  - variant: 'default' | 'small'
 */
const PreviewTile = ({ title, src, variant = 'default' }) => {
  if (!src) {
    return <div className={`previewPlaceholder ${variant}`}>{title}</div>;
  }

  // build responsive srcSet (Unsplash accepts `w` and `fm=webp`)
  const srcWebp = (w) => `${src.split('?')[0]}?auto=format&fit=crop&w=${w}&q=60&fm=webp`;
  const srcJpg = (w) => `${src.split('?')[0]}?auto=format&fit=crop&w=${w}&q=60`;

  const srcSet = `
    ${srcWebp(320)} 320w,
    ${srcWebp(480)} 480w,
    ${srcWebp(720)} 720w,
    ${srcWebp(900)} 900w
  `;

  const sizes = variant === 'small' ? '(max-width:560px) 100px, 120px' : '(max-width:920px) 45vw, 260px';

  return (
    <picture>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        className={`previewImg ${variant}`}
        src={srcJpg(720)}
        srcSet={srcSet}
        sizes={sizes}
        alt={title}
        loading="lazy"
        decoding="async"
        width={variant === 'small' ? 120 : 260}
        height={variant === 'small' ? 84 : 150}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </picture>
  );
};

export default PreviewTile;
