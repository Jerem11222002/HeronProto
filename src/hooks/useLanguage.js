import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../context/languageContext';

/**
 * Hook to use language context with automatic re-renders when language changes
 * Usage: const { language, t } = useLanguage();
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  const [, setRenderTrigger] = useState(0);

  useEffect(() => {
    const handleLanguageChange = () => {
      // Trigger a re-render when language changes
      setRenderTrigger(prev => prev + 1);
    };

    window.addEventListener('languageChanged', handleLanguageChange);
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  return context || { language: 'en', setLanguage: () => {}, t: (key) => key };
};
