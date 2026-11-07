export { stripForeignScripts } from '../../text-cleanup';

// NFR-07: recipe and chat output is checked for unsafe food handling (WHO Five Keys to Safer
// Food) and for medical or nutritional advice, after the model answers and before the user sees it.
// The patterns are a backstop to the prompt, not a replacement for it.

export type Lang = 'ar' | 'en';

const UNSAFE_HANDLING: RegExp[] = [
  /\b(leave|keep|left|sit)\b[^.]{0,40}\b(out|on the counter|at room temperature)\b[^.]{0,30}\b(overnight|all night|all day|until (the )?next day)/i,
  /\breheat\w*\b[^.]{0,30}\b(twice|again and again|several times|more than once|as many times)/i,
  /\bwash\w*\b[^.]{0,20}\braw (chicken|poultry|meat)/i,
  /\b(thaw|defrost)\w*\b[^.]{0,30}\b(on the counter|at room temperature|in hot water)/i,
  /\btaste\b[^.]{0,30}\b(to (check|see|tell))\b[^.]{0,30}\b(spoil|gone (bad|off)|safe)/i,
  /\b(rare|pink|undercooked)\b[^.]{0,20}\b(chicken|poultry|minced meat|kofta)/i,
  /(سيب|سيبه|سيبها|اتركه|اتركها)[^.]{0,40}(برة|بره|خارج التلاجة|على الرخامة|في درجة حرارة الغرفة)[^.]{0,30}(طول الليل|لتاني يوم|لليوم التاني|للصبح)/,
  /(سخّن|سخن|تسخين|سخنه|سخنها)[^.]{0,30}(مرتين|أكتر من مرة|اكتر من مرة|كذا مرة)/,
  /(اغسل|اغسلي|غسل)[^.]{0,20}(الفراخ|الفرخة|اللحمة)\s*(النية|النيئة|الني)/,
  /(دوق|دوقي|تذوق)[^.]{0,30}(عشان تعرف|لتعرف)[^.]{0,30}(باظ|بايظ|فاسد|سليم)/,
];

const MEDICAL: RegExp[] = [
  /\b(cure|cures|treat|treats|treatment|prevent(s)? (cancer|diabetes|disease)|lowers? (blood (sugar|pressure)|cholesterol)|dose|dosage|medication|medicine)\b/i,
  /(يعالج|علاج|يشفي|دواء|جرعة|ينزّل السكر|ينزل السكر|يخفض الضغط|يقلل الكوليسترول)/,
];

const LEFTOVERS =
  /\b(leftover|left over|reheat|yesterday'?s|cooked (rice|chicken|meat|pasta))|بايت|فاضل من|متبقي|سخّن|سخن|تسخين|من امبارح|مطبوخ/i;

export function isUnsafe(text: string): boolean {
  return UNSAFE_HANDLING.some((p) => p.test(text));
}

export function isMedical(text: string): boolean {
  return MEDICAL.some((p) => p.test(text));
}

export function mentionsLeftovers(text: string): boolean {
  return LEFTOVERS.test(text);
}

export const TEXT: Record<Lang, { decline: string; unsafe: string; reheating: string; fallback: (items: string[]) => string }> = {
  ar: {
    decline: 'أنا بساعدك في الطبخ والأكل اللي عندك بس. اسألني عن وصفة أو إزاي تحفظ أكلك.',
    unsafe:
      'مش هقدر أنصحك بالطريقة دي لأنها مش آمنة. حط الأكل المطبوخ في التلاجة خلال ساعتين، واطبخ الفراخ واللحمة كويس لحد ما تستوي من جوه.',
    reheating: 'سخّن الأكل البايت مرة واحدة بس لحد ما يغلي ويسخن من جوه خالص، وكُله خلال 3 أيام (والرز المطبوخ خلال يوم).',
    fallback: (items) =>
      items.length
        ? `مساعد الطبخ مش متاح دلوقتي. استخدم دول الأول لأنهم قربوا يخلصوا: ${items.join('، ')}. جرّب تسأل تاني بعد شوية.`
        : 'مساعد الطبخ مش متاح دلوقتي. جرّب تسأل تاني بعد شوية.',
  },
  en: {
    decline: 'I can only help with cooking and the food you have. Ask me for a recipe or how to store your food.',
    unsafe:
      "I can't recommend that, because it isn't safe. Put cooked food in the fridge within 2 hours, and cook chicken and meat all the way through.",
    reheating: 'Reheat leftovers only once, until steaming hot all the way through, and eat them within 3 days (cooked rice within 1 day).',
    fallback: (items) =>
      items.length
        ? `The cooking assistant isn't available right now. Use these first, they expire soonest: ${items.join(', ')}. Try asking again in a few minutes.`
        : "The cooking assistant isn't available right now. Try asking again in a few minutes.",
  },
};
