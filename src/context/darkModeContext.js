import React, { createContext, useState, useEffect } from 'react';

export const DarkModeContext = createContext({ darkMode: false, setDarkMode: () => {} });

export const DarkModeContextProvider = ({ children }) => {
  const readInitial = () => {
    try {
      // 1) per-user persisted theme key (userTheme_<id>) if present
      try {
        const currentUserJson = localStorage.getItem('currentUser') || localStorage.getItem('adminUser');
        if (currentUserJson) {
          const user = JSON.parse(currentUserJson);
          const uid = user._id || user.id || user.idStr || user.username || null;
          if (uid) {
            const per = localStorage.getItem(`userTheme_${uid}`);
            if (per === 'dark') return true;
            if (per === 'light') return false;
          }
        }
      } catch (e) { /* ignore parse errors */ }

      // 2) canonical 'theme' key written by settings
      const canonical = localStorage.getItem('theme');
      if (canonical === 'dark') return true;
      if (canonical === 'light') return false;

      // 3) legacy user.customization stored in currentUser/adminUser
      const currentUserJson = localStorage.getItem('currentUser') || localStorage.getItem('adminUser');
      if (currentUserJson) {
        try {
          const user = JSON.parse(currentUserJson);
          const theme = user?.customization?.theme || user?.theme;
          if (theme === 'dark') return true;
          if (theme === 'light') return false;
        } catch (e) { /* ignore */ }
      }

      // 4) old boolean fallback
      const stored = localStorage.getItem('darkMode');
      if (stored === 'true') return true;
      if (stored === 'false') return false;

      // 5) system preference
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  };

  const [darkMode, setDarkModeState] = useState(readInitial);

  const applyClass = (isDark) => {
    try {
      document.documentElement.classList.remove(isDark ? 'theme-light' : 'theme-dark');
      document.documentElement.classList.add(isDark ? 'theme-dark' : 'theme-light');
    } catch (e) {}
  };

  const setDarkMode = (value) => {
    const v = !!value;
    setDarkModeState(v);
    try {
      applyClass(v);
      localStorage.setItem('darkMode', v ? 'true' : 'false');
      localStorage.setItem('theme', v ? 'dark' : 'light');
    } catch (e) {}
  };

  useEffect(() => {
    applyClass(darkMode);
  }, [darkMode]);

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};
