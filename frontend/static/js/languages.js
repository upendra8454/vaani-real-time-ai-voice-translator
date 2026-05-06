// Vaani — Language Configuration
const LANGUAGES = {
  "en":  { name: "English",    native: "English",        gtts: "en", rtl: false },
  "hi":  { name: "Hindi",      native: "हिन्दी",          gtts: "hi", rtl: false },
  "ta":  { name: "Tamil",      native: "தமிழ்",          gtts: "ta", rtl: false },
  "te":  { name: "Telugu",     native: "తెలుగు",          gtts: "te", rtl: false },
  "bn":  { name: "Bengali",    native: "বাংলা",           gtts: "bn", rtl: false },
  "mr":  { name: "Marathi",    native: "मराठी",           gtts: "mr", rtl: false },
  "gu":  { name: "Gujarati",   native: "ગુજરાતી",         gtts: "gu", rtl: false },
  "kn":  { name: "Kannada",    native: "ಕನ್ನಡ",           gtts: "kn", rtl: false },
  "ml":  { name: "Malayalam",  native: "മലയാളം",          gtts: "ml", rtl: false },
  "pa":  { name: "Punjabi",    native: "ਪੰਜਾਬੀ",          gtts: "pa", rtl: false },
  "or":  { name: "Odia",       native: "ଓଡ଼ିଆ",           gtts: "or", rtl: false },
  "ur":  { name: "Urdu",       native: "اردو",            gtts: "ur", rtl: true  },
  "as":  { name: "Assamese",   native: "অসমীয়া",          gtts: "as", rtl: false },
  "mai": { name: "Maithili",   native: "मैथिली",          gtts: "hi", rtl: false },
  "sa":  { name: "Sanskrit",   native: "संस्कृतम्",        gtts: "sa", rtl: false },
};

function populateLanguageSelects() {
  const srcEl = document.getElementById("source-lang");
  const tgtEl = document.getElementById("target-lang");
  if (!srcEl || !tgtEl) return;

  Object.entries(LANGUAGES).forEach(([code, lang]) => {
    const makeOpt = () => {
      const o = document.createElement("option");
      o.value = code;
      o.textContent = `${lang.native} — ${lang.name}`;
      return o;
    };
    srcEl.appendChild(makeOpt());
    tgtEl.appendChild(makeOpt());
  });

  srcEl.value = "en";
  tgtEl.value = "hi";
}
