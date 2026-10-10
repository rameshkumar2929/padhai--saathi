export const LANGUAGES = [
  { name: "English", nativeName: "English", code: "en", direction: "ltr", fontFamily: "" },
  { name: "Hindi", nativeName: "हिन्दी", code: "hi", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
  { name: "Gujarati", nativeName: "ગુજરાતી", code: "gu", direction: "ltr", fontFamily: "Noto Sans Gujarati" },
  { name: "Marathi", nativeName: "मराठी", code: "mr", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
  { name: "Bengali", nativeName: "বাংলা", code: "bn", direction: "ltr", fontFamily: "Noto Sans Bengali" },
  { name: "Tamil", nativeName: "தமிழ்", code: "ta", direction: "ltr", fontFamily: "Noto Sans Tamil" },
  { name: "Telugu", nativeName: "తెలుగు", code: "te", direction: "ltr", fontFamily: "Noto Sans Telugu" },
  { name: "Kannada", nativeName: "ಕನ್ನಡ", code: "kn", direction: "ltr", fontFamily: "Noto Sans Kannada" },
  { name: "Malayalam", nativeName: "മലയാളം", code: "ml", direction: "ltr", fontFamily: "Noto Sans Malayalam" },
  { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", code: "pa", direction: "ltr", fontFamily: "Noto Sans Gurmukhi" },
  { name: "Odia", nativeName: "ଓଡ଼ିଆ", code: "or", direction: "ltr", fontFamily: "Noto Sans Oriya" },
  { name: "Assamese", nativeName: "অসমীয়া", code: "as", direction: "ltr", fontFamily: "Noto Sans Bengali" },
  { name: "Urdu", nativeName: "اردو", code: "ur", direction: "rtl", fontFamily: "Noto Nastaliq Urdu" },
  { name: "Nepali", nativeName: "नेपाली", code: "ne", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
  { name: "Sanskrit", nativeName: "संस्कृतम्", code: "sa", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
  { name: "Maithili", nativeName: "मैथिली", code: "mai", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
  { name: "Konkani", nativeName: "कोंकणी", code: "kok", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
  { name: "Sindhi", nativeName: "سنڌي", code: "sd", direction: "rtl", fontFamily: "Noto Naskh Arabic" },
  { name: "Kashmiri", nativeName: "कॉशुर", code: "ks", direction: "rtl", fontFamily: "Noto Naskh Arabic" },
  { name: "Dogri", nativeName: "डोगरी", code: "doi", direction: "ltr", fontFamily: "Noto Sans Devanagari" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];
export type CoreLanguage = "en" | "hi" | "gu";
export const translationStorageKey = "padhai-saathi-translations-v1";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGES.some((language) => language.code === value);
}

export function getLanguage(code: Language) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

export function coreLanguage(code: Language): CoreLanguage {
  return code === "hi" || code === "gu" ? code : "en";
}
