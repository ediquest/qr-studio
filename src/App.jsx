import React from 'react';
import BarcodeStudio from './components/BarcodeStudio.jsx';
import { I18nProvider, useI18n } from './i18n.jsx';

function Banner(){
  const { t, lang, setLang } = useI18n();
  return (
    <div className="banner no-print">
      <div className="banner-inner">
        <div className="banner-title">{t('app.title')}</div>
        <label className="hstack small" style={{gap:6}}>
          {t('app.lang')}
          <select className="select" value={lang} onChange={e=>setLang(e.target.value)}>
            <option value="pl">PL</option>
            <option value="en">EN</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function AppFooter(){
  const y = new Date().getFullYear();
  return <footer className="app-footer no-print" style={{marginTop:12}}>© {y} Adrian Sarczyński</footer>;
}

export default function App(){
  return (
    <I18nProvider>
      <div className="container">
        <Banner />
        <BarcodeStudio />
        <AppFooter />
      </div>
    </I18nProvider>
  );
}
