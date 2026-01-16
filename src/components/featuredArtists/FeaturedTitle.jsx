import { useLanguage } from "../../hooks/useLanguage";
import "./FeaturedTitle.scss"

const FeaturedTitle = () => {
  const { t } = useLanguage();
  
  return (
    <div className="featured-title">
      <div className="title-container">
        <h1>{t('featured-artists')}</h1>
        <span className="view-all">{t('view-all')}</span>
      </div>
      <div className="title-description">
        <p>{t('discover-artists')}</p>
      </div>
    </div>
  )
}

export default FeaturedTitle