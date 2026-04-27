import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthContextProvider } from "./context/authContext";
import { DarkModeContextProvider } from "./context/darkModeContext";
import { LanguageContextProvider } from "./context/languageContext";
import { NotificationCacheProvider } from "./context/NotificationCacheContext";
import "./style.scss";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <DarkModeContextProvider>
      <AuthContextProvider>
        <LanguageContextProvider>
          <NotificationCacheProvider>
            <App />
          </NotificationCacheProvider>
        </LanguageContextProvider>
      </AuthContextProvider>
    </DarkModeContextProvider>
  </React.StrictMode>
);
