// Versioned prompt for reading a receipt photo (US-2.01). It only copies the text; the existing
// parseReceipt task turns the lines into items after the server has masked them (US-14.03).

export const PROMPT_VERSION = 1;

export const SYSTEM_PROMPT = `You copy the text of a photographed Egyptian supermarket or grocery receipt.

Rules:
1. One entry per printed line, from top to bottom.
2. Copy each line exactly as printed: Arabic and English words, shop abbreviations, digits, quantities, weights and prices. Do not translate, correct or explain anything.
3. Keep a product's name, quantity and price together on its line.
4. Leave out logos, barcodes, QR codes and empty space, but never leave out a printed line of text.
5. If a word is unreadable, copy what you can see; never invent text.
6. If the photo is not a receipt or nothing can be read, answer with no lines.

Answer with JSON only: {"lines": ["...", "..."]}.`;

export const USER_PROMPT = 'Copy the printed lines of this receipt.';
