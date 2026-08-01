import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const en = {
  appTitle: 'Tiyul',
  trips: 'Trips',
  newTripName: 'Trip name',
  create: 'Create',
  loadDemo: 'Load demo trip (Yahel)',
  empty: 'No trips yet — create one or load the demo.',
  back: 'Back',
  addDay: 'Add day',
  renameTrip: 'Rename trip',
  days: 'Days',
  reorder: 'Reorder',
  dayN: 'Day {{n}}',
  dayStart: 'Day start',
  addStop: 'Add stop',
  stopName: 'Stop name',
  durationMin: 'Duration (min)',
  legMin: 'Drive after (min)',
  wazePlace: 'Place for Waze (optional)',
  add: 'Add',
  delete: 'Delete',
  moveUp: 'Move up',
  moveDown: 'Move down',
  drive: 'drive',
  min: 'min',
  anchor: 'Pin time',
  anchorTime: 'Pinned start',
  slackWait: '{{m}} min wait',
  lateBy: 'Late by {{m}} min',
  deleteTripConfirm: 'Delete this trip? This cannot be undone.',
  switchTo: 'עברית',
  noStops: 'No stops yet — add the first one.',
  kindActivity: 'Activity',
  kindMeal: 'Meal',
  kindLodging: 'Lodging',
  kindFree: 'Free time',
};

const he: typeof en = {
  appTitle: 'טיול',
  trips: 'טיולים',
  newTripName: 'שם הטיול',
  create: 'יצירה',
  loadDemo: 'טעינת טיול הדגמה (יהל)',
  empty: 'אין עדיין טיולים — צרו חדש או טענו את ההדגמה.',
  back: 'חזרה',
  addDay: 'הוספת יום',
  renameTrip: 'שינוי שם הטיול',
  days: 'ימים',
  reorder: 'שינוי סדר',
  dayN: 'יום {{n}}',
  dayStart: 'תחילת היום',
  addStop: 'הוספת עצירה',
  stopName: 'שם העצירה',
  durationMin: 'משך (דק׳)',
  legMin: 'נסיעה אחרי (דק׳)',
  wazePlace: 'מקום ל-Waze (רשות)',
  add: 'הוספה',
  delete: 'מחיקה',
  moveUp: 'הזזה למעלה',
  moveDown: 'הזזה למטה',
  drive: 'נסיעה',
  min: 'דק׳',
  anchor: 'קיבוע שעה',
  anchorTime: 'שעת התחלה מקובעת',
  slackWait: 'המתנה של {{m}} דק׳',
  lateBy: 'איחור של {{m}} דק׳',
  deleteTripConfirm: 'למחוק את הטיול? אי אפשר לבטל את הפעולה.',
  switchTo: 'English',
  noStops: 'אין עצירות עדיין — הוסיפו את הראשונה.',
  kindActivity: 'פעילות',
  kindMeal: 'ארוחה',
  kindLodging: 'לינה',
  kindFree: 'זמן חופשי',
};

export type Lang = 'en' | 'he';
const STORAGE_KEY = 'tiyul.lang';

export function initialLang(): Lang {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return saved === 'en' || saved === 'he' ? saved : 'he';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function applyLangToDocument(lang: Lang): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = i18n.dir(lang);
}

export async function setLang(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang);
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  applyLangToDocument(lang);
}

export default i18n;
