// Fixed words on generated sites (headings, labels, buttons) in English and Nepali.
// Keyed by the English text, so English output is unchanged; {name}-style slots are filled in.
// The client's own words (name, description, services...) come from the intake instead.

const NE = {
  'What we do': 'हामी के गर्छौं',
  Services: 'सेवाहरू',
  'For {x}.': '{x}का लागि।',
  'Learn more →': 'थप जान्नुहोस् →',
  'About us': 'हाम्रो बारेमा',
  'Meet {name}': '{name}लाई चिन्नुहोस्',
  'Our story': 'हाम्रो कथा',
  Gallery: 'तस्बिरहरू',
  Testimonials: 'ग्राहकका अनुभव',
  'What customers say': 'ग्राहकहरू के भन्छन्',
  'Customer testimonials': 'ग्राहकका अनुभवहरू',
  'Ready to work with {name}?': '{name}सँग काम गर्न तयार हुनुहुन्छ?',
  'Serving {x}.': '{x}मा सेवा दिँदै।',
  'Get in touch today.': 'आजै सम्पर्क गर्नुहोस्।',
  'About {name}': '{name}को बारेमा',
  About: 'हाम्रो बारेमा',
  'How it started': 'यसरी सुरु भयो',
  Mission: 'उद्देश्य',
  Values: 'मूल्यहरू',
  Experience: 'अनुभव',
  '{n}+ years': '{n}+ वर्ष',
  'What we stand for': 'हाम्रो मान्यता',
  'Why people choose us': 'मानिसहरू हामीलाई किन रोज्छन्',
  'Inside {name}': '{name}भित्र',
  'Work with {name}': '{name}सँग काम गर्नुहोस्',
  'Service {n}': 'सेवा {n}',
  'Ask about this': 'यसबारे सोध्नुहोस्',
  'Jump to': 'सिधै जानुहोस्',
  'Services on this page': 'यस पृष्ठका सेवाहरू',
  'Not sure which service you need?': 'कुन सेवा चाहिन्छ, निश्चित हुनुहुन्न?',
  'Tell us what you are looking for and we will point you in the right direction.': 'तपाईं के खोज्दै हुनुहुन्छ भन्नुहोस्, हामी सही बाटो देखाउँछौं।',
  'Contact us': 'सम्पर्क गर्नुहोस्',
  Contact: 'सम्पर्क',
  'Get in touch': 'सम्पर्कमा रहनुहोस्',
  'Send us a message': 'हामीलाई सन्देश पठाउनुहोस्',
  Email: 'इमेल',
  Phone: 'फोन',
  WhatsApp: 'ह्वाट्सएप',
  Address: 'ठेगाना',
  'Service area': 'सेवा क्षेत्र',
  'Email us': 'इमेल गर्नुहोस्',
  'Call us': 'फोन गर्नुहोस्',
  'WhatsApp us': 'ह्वाट्सएप गर्नुहोस्',
  'Visit us': 'भेट्न आउनुहोस्',
  Home: 'गृहपृष्ठ',
  Blog: 'ब्लग',
  'years in business': 'वर्षको अनुभव',
  'core service': 'मुख्य सेवा',
  'core services': 'मुख्य सेवाहरू',
  'service area': 'सेवा क्षेत्र',
  'based in': 'स्थान',
  'Opening hours': 'खुल्ने समय',
  'Come and see us': 'हामीलाई भेट्न आउनुहोस्',
  'Come and see us in {x}': '{x}मा हामीलाई भेट्न आउनुहोस्',
  Questions: 'प्रश्नहरू',
  'Frequently asked questions': 'धेरै सोधिने प्रश्नहरू',
  'The people': 'हाम्रो टोली',
  'Meet the team': 'टोलीलाई चिन्नुहोस्',
  'Before & after': 'पहिले र पछि',
  'See the difference': 'फरक हेर्नुहोस्',
  Before: 'पहिले',
  After: 'पछि',
  'Scroll down': 'तल जानुहोस्',
  Pages: 'पृष्ठहरू',
  '© {name}. All rights reserved.': '© {name}। सर्वाधिकार सुरक्षित।',
  Shop: 'पसल',
  'Popular products': 'लोकप्रिय सामानहरू',
  'Visit the shop': 'पसल हेर्नुहोस्',
  'Pay with eSewa, Khalti or cash on delivery.': 'ईसेवा, खल्ती वा सामान आइपुगेपछि नगदमा तिर्नुहोस्।',
  // Common main-button texts (the intake's ctaLabel), used when no Nepali label was given.
  'Get a quote': 'मूल्य सोध्नुहोस्',
  'Book an appointment': 'समय बुक गर्नुहोस्',
  'Book a class': 'कक्षा बुक गर्नुहोस्',
  'Book a table': 'टेबल बुक गर्नुहोस्',
  'Reserve a table': 'टेबल बुक गर्नुहोस्',
  'Request a call back': 'फोन गर्न अनुरोध गर्नुहोस्',
  'Order now': 'अहिले अर्डर गर्नुहोस्',
  'Shop now': 'अहिले किन्नुहोस्',
  'Book now': 'अहिले बुक गर्नुहोस्',
  'Enquire now': 'सोधपुछ गर्नुहोस्',
};

let current = 'en';
const setLang = (lang) => {
  current = lang === 'ne' ? 'ne' : 'en';
};
const getLang = () => current;

// t('Meet {name}', { name }) -> the text in the current language, slots filled in.
function t(text, vars = {}) {
  const out = current === 'ne' && NE[text] ? NE[text] : text;
  return out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

const has = (text) => Object.prototype.hasOwnProperty.call(NE, text);

module.exports = { t, setLang, getLang, has, NE };
