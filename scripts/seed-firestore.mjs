/**
 * Seeds the Information Hub collections (`laws`, `faqs`, `safetyTips`, `news`)
 * with the initial curated content used for testing and demos.
 *
 * Manual, one-off tool — never runs in CI. Uses the Firebase Admin SDK with
 * application-default credentials:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   GOOGLE_CLOUD_PROJECT=surakshak-2869a \
 *   node scripts/seed-firestore.mjs
 *
 * Idempotent: a document that already exists is left untouched, so it is safe
 * to run repeatedly.
 */

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DAY_MS = 86_400_000;
const now = Date.now();

const LAWS = [
  {
    id: 'law_1',
    title: 'Protection of Women from Domestic Violence Act, 2005',
    shortDescription:
      'Protects women from physical, emotional, sexual, and economic abuse by family members.',
    fullContent:
      'The Protection of Women from Domestic Violence Act 2005 provides more effective protection of the rights of women guaranteed under the Constitution who are victims of violence of any kind occurring within the family. The Act covers women in various domestic relationships including wives, daughters, mothers, sisters, and live-in partners. Under this Act, a woman can file a protection order, residence order, monetary relief, custody order, or compensation order.',
    category: 'Domestic Safety',
    tags: ['domestic violence', 'protection order', 'family', 'abuse'],
    order: 1,
    isPublished: true,
  },
  {
    id: 'law_2',
    title: 'Sexual Harassment of Women at Workplace Act, 2013',
    shortDescription:
      'Every employer must provide a safe working environment and set up an Internal Complaints Committee.',
    fullContent:
      'The Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act 2013 makes it mandatory for every employer to constitute an Internal Complaints Committee at each office or branch with 10 or more employees. The Act defines sexual harassment broadly to include unwelcome physical contact, a demand for sexual favors, sexually colored remarks, showing pornography, or any other unwelcome physical, verbal, or non-verbal conduct of a sexual nature.',
    category: 'Workplace Safety',
    tags: ['workplace', 'harassment', 'ICC', 'employer'],
    order: 2,
    isPublished: true,
  },
  {
    id: 'law_3',
    title: 'Dowry Prohibition Act, 1961',
    shortDescription:
      'Taking or giving dowry at marriage is illegal and punishable with imprisonment.',
    fullContent:
      'The Dowry Prohibition Act 1961 prohibits the giving or taking of dowry. Dowry is defined as any property or valuable security given or agreed to be given by one party in a marriage to the other party. Violating this Act is punishable with imprisonment of not less than 5 years and a fine of not less than ₹15,000. Section 498A of IPC also provides protection against dowry harassment.',
    category: 'Marriage Rights',
    tags: ['dowry', 'marriage', 'harassment', '498A'],
    order: 3,
    isPublished: true,
  },
  {
    id: 'law_4',
    title: 'IPC Section 354 — Assault on Women',
    shortDescription:
      'Assault or criminal force on a woman with intent to outrage her modesty is punishable.',
    fullContent:
      'Section 354 of the Indian Penal Code states that whoever assaults or uses criminal force on any woman, intending to outrage or knowing it to be likely that he will thereby outrage her modesty, shall be punished with imprisonment of either description for a term which shall not be less than one year but may extend to five years, and shall also be liable to fine.',
    category: 'Personal Safety',
    tags: ['assault', 'modesty', 'IPC', 'public safety'],
    order: 4,
    isPublished: true,
  },
  {
    id: 'law_5',
    title: 'The Maternity Benefit Act, 1961',
    shortDescription: 'Women employees are entitled to 26 weeks of paid maternity leave.',
    fullContent:
      'The Maternity Benefit (Amendment) Act 2017 increased paid maternity leave from 12 to 26 weeks for women employees in establishments with 10 or more employees. It also mandates creche facilities for establishments with 50+ employees and allows work from home after the maternity leave period. A woman cannot be dismissed or have her service conditions changed to her disadvantage during maternity leave.',
    category: 'Workplace Rights',
    tags: ['maternity', 'leave', 'pregnancy', 'workplace'],
    order: 5,
    isPublished: true,
  },
  {
    id: 'law_6',
    title: 'Equal Remuneration Act, 1976',
    shortDescription: 'Men and women must receive equal pay for equal work.',
    fullContent:
      'The Equal Remuneration Act 1976 provides for payment of equal remuneration to men and women workers for the same work or work of similar nature. No employer can pay to any worker, employed by the employer, at rates less favorable than those at which remuneration is paid to a worker of the opposite sex for performing the same work or work of a similar nature.',
    category: 'Workplace Rights',
    tags: ['equal pay', 'salary', 'discrimination', 'employment'],
    order: 6,
    isPublished: true,
  },
  {
    id: 'law_7',
    title: 'IPC Section 509 — Word or Gesture Insulting Modesty',
    shortDescription: 'Verbal or physical harassment of women in public is a criminal offence.',
    fullContent:
      'Section 509 of the Indian Penal Code states that whoever, intending to insult the modesty of any woman, utters any word, makes any sound or gesture, or exhibits any object, intending that such word or sound shall be heard, or that such gesture or object shall be seen, by such woman, or intrudes upon the privacy of such woman, shall be punished with simple imprisonment for a term which may extend to 3 years, and also with fine.',
    category: 'Personal Safety',
    tags: ['eve teasing', 'verbal harassment', 'public', 'IPC'],
    order: 7,
    isPublished: true,
  },
  {
    id: 'law_8',
    title: 'The Indecent Representation of Women Act, 1986',
    shortDescription:
      'Prohibits indecent representation of women in advertisements, publications, and media.',
    fullContent:
      'The Indecent Representation of Women (Prohibition) Act 1986 prohibits indecent representation of women through advertisements or in publications, writings, paintings, figures, or in any other manner. Violation is punishable with imprisonment up to 2 years and a fine up to ₹2,000 for the first offence, and up to 5 years and ₹5,000 for subsequent offences.',
    category: 'Digital Safety',
    tags: ['media', 'advertisement', 'representation', 'dignity'],
    order: 8,
    isPublished: true,
  },
  {
    id: 'law_9',
    title: 'IT Act Section 66E & 67A — Cyber Crimes Against Women',
    shortDescription:
      'Sharing private images or sexually explicit content without consent is a criminal offence.',
    fullContent:
      'Section 66E of the Information Technology Act punishes violation of privacy by capturing, publishing, or transmitting the image of a private area of any person without consent, with imprisonment up to 3 years or fine up to ₹2 lakhs. Section 67A punishes publishing or transmitting sexually explicit material electronically with imprisonment up to 5 years and fine up to ₹10 lakhs.',
    category: 'Digital Safety',
    tags: ['cyber crime', 'privacy', 'online harassment', 'IT Act'],
    order: 9,
    isPublished: true,
  },
  {
    id: 'law_10',
    title: 'POCSO Act, 2012 — Protection of Children',
    shortDescription: 'Strong protection for children under 18 from sexual abuse and exploitation.',
    fullContent:
      'The Protection of Children from Sexual Offences (POCSO) Act 2012 is a comprehensive law to protect children from sexual assault, sexual harassment, and pornography. The Act defines a child as any person below the age of 18 years. It provides for child-friendly procedures for reporting, recording of evidence, investigation and speedy trial through designated Special Courts.',
    category: 'Child Safety',
    tags: ['children', 'POCSO', 'sexual abuse', 'minor'],
    order: 10,
    isPublished: true,
  },
];

const FAQS = [
  {
    id: 'faq_1',
    question: 'What should I do if I feel unsafe while travelling alone?',
    answer:
      'Share your live location with a trusted contact using Surakshak. Keep emergency numbers (112, 100) ready. Stay in well-lit, populated areas. Trust your instincts — if something feels wrong, move to a public place like a shop or restaurant. If in a cab, note the vehicle number and share it.',
    category: 'Travel Safety',
    order: 1,
    isPublished: true,
  },
  {
    id: 'faq_2',
    question: 'How do I file an FIR for harassment?',
    answer:
      'Go to the nearest police station and request to file an FIR. You have the right to file an FIR at any police station. If police refuse, you can approach a magistrate directly. Women can file an FIR at any time of day and can request a woman police officer. Keep a copy of the FIR — the police must give you one free of charge.',
    category: 'Legal Help',
    order: 2,
    isPublished: true,
  },
  {
    id: 'faq_3',
    question: 'What is the Women Helpline number?',
    answer:
      'The national Women Helpline number is 1091. The Mahila Helpline (for domestic violence) is 181. These are available 24/7. You can also call 112 for any emergency — it connects to police, ambulance, and fire services.',
    category: 'Emergency',
    order: 3,
    isPublished: true,
  },
  {
    id: 'faq_4',
    question: 'What should I do if someone follows me?',
    answer:
      "Do not go home directly. Enter a crowded public space like a mall, restaurant, or shop. Call a friend or family member and stay on the call. If danger is imminent, call 100 (police) or use Surakshak SOS. Note the person's description. Your safety is more important than confrontation — avoid engaging with the follower.",
    category: 'Personal Safety',
    order: 4,
    isPublished: true,
  },
  {
    id: 'faq_5',
    question: 'Can I take legal action against online harassment?',
    answer:
      'Yes. Cyberstalking is punishable under Section 354D IPC (up to 3 years). Sharing intimate images without consent falls under IT Act Section 66E (up to 3 years). Report to the National Cyber Crime Reporting Portal at cybercrime.gov.in or call 1930. Preserve screenshots and evidence before reporting.',
    category: 'Digital Safety',
    order: 5,
    isPublished: true,
  },
  {
    id: 'faq_6',
    question: 'What are my rights if I face harassment at work?',
    answer:
      "Under the POSH Act 2013, every workplace with 10+ employees must have an Internal Complaints Committee (ICC). You can file a complaint with the ICC within 3 months of the incident. The ICC must complete inquiry within 90 days. You can also approach the Local Complaints Committee (LCC) if the employer doesn't have an ICC.",
    category: 'Workplace Safety',
    order: 6,
    isPublished: true,
  },
  {
    id: 'faq_7',
    question: 'How does the Surakshak SOS work?',
    answer:
      "Tap the SOS button 3 times quickly on the home screen. A 5-second countdown will begin — you can cancel it if triggered by mistake. After the countdown, Surakshak automatically sends SMS alerts with your current location to all your emergency contacts. The SMS works even with slow internet as it uses your phone's SIM card.",
    category: 'App Help',
    order: 7,
    isPublished: true,
  },
  {
    id: 'faq_8',
    question: 'What is Safe Journey Mode?',
    answer:
      "Safe Journey Mode lets you share your journey details with trusted contacts. Enter your destination and expected arrival time. If you don't check in by the arrival time, Surakshak automatically sends an alert to your contacts with your last known location. Use it whenever you travel alone, especially at night.",
    category: 'App Help',
    order: 8,
    isPublished: true,
  },
  {
    id: 'faq_9',
    question: 'Can I get a restraining order against someone?',
    answer:
      "Yes, under the Domestic Violence Act 2005, you can file for a Protection Order in a magistrate's court. The magistrate can issue an ex-parte (one-sided) order the same day if there is immediate danger. NGOs like iCall, Majlis, and Snehi can provide free legal support to help you file.",
    category: 'Legal Help',
    order: 9,
    isPublished: true,
  },
  {
    id: 'faq_10',
    question: 'What should I carry for personal safety?',
    answer:
      'Keep your phone charged. Save emergency numbers (112, 100, 1091) on speed dial. A personal alarm (keychain alarm) can attract attention in dangerous situations. Know your route before travelling. Tell someone where you are going and when you expect to return. Trust your instincts — feeling unsafe is enough reason to leave a situation.',
    category: 'Personal Safety',
    order: 10,
    isPublished: true,
  },
];

const SAFETY_TIPS = [
  {
    id: 'tip_1',
    title: 'Note the cab number before you get in',
    content:
      'Photograph the number plate and send it to a trusted contact along with the driver name shown in the app. Do this where the driver can see you — it is a strong deterrent.',
    category: 'Travel',
    order: 1,
    isPublished: true,
  },
  {
    id: 'tip_2',
    title: 'Sit behind the driver, never in the front',
    content:
      'The seat diagonally behind the driver is the hardest for them to reach. Keep a door unlocked on your side and stay near well-lit main roads.',
    category: 'Travel',
    order: 2,
    isPublished: true,
  },
  {
    id: 'tip_3',
    title: 'Share your live trip on every night journey',
    content:
      'Start Safe Journey or live location in Surakshak before you set off. Tell the person you shared it with your expected arrival time so they know when to check on you.',
    category: 'Travel',
    order: 3,
    isPublished: true,
  },
  {
    id: 'tip_4',
    title: 'Save your building security on speed dial',
    content:
      'Keep the society guard, gate, and manager numbers in your phone favourites. A quick call is faster than explaining your location to the police in an emergency.',
    category: 'Home',
    order: 4,
    isPublished: true,
  },
  {
    id: 'tip_5',
    title: 'Verify visitors before opening the door',
    content:
      'Ask delivery and service staff to wait while you confirm the order or appointment by phone. Use the door chain or peephole and never confirm that you are home alone.',
    category: 'Home',
    order: 5,
    isPublished: true,
  },
  {
    id: 'tip_6',
    title: 'Keep one emergency contact who has a spare key',
    content:
      'Give a spare key to a neighbour or relative you trust. If you are ever locked in or need help fast, they can reach you without waiting for a locksmith.',
    category: 'Home',
    order: 6,
    isPublished: true,
  },
  {
    id: 'tip_7',
    title: 'Write down every harassment incident',
    content:
      'Record the date, time, place, what was said or done, and who else was present. A dated log written soon after the event carries far more weight before an ICC or court.',
    category: 'Workplace',
    order: 7,
    isPublished: true,
  },
  {
    id: 'tip_8',
    title: 'Know who is on your Internal Complaints Committee',
    content:
      'Every workplace with 10 or more staff must display the ICC members and how to reach them. Find this out before you need it so a complaint is not delayed.',
    category: 'Workplace',
    order: 8,
    isPublished: true,
  },
  {
    id: 'tip_9',
    title: 'Do not travel alone with a colleague who makes you uneasy',
    content:
      'Decline shared cabs or late field visits that leave you isolated with someone you do not trust. A polite, firm no is enough — you owe no explanation.',
    category: 'Workplace',
    order: 9,
    isPublished: true,
  },
  {
    id: 'tip_10',
    title: 'Use a profile photo that does not reveal your location',
    content:
      'Avoid pictures with your building, street sign, workplace, or car number visible. Crop or blur backgrounds before posting on public profiles.',
    category: 'Online',
    order: 10,
    isPublished: true,
  },
  {
    id: 'tip_11',
    title: 'Turn off location tags on your posts',
    content:
      'Disable automatic geotagging in your camera and social apps. Post about a place only after you have left it, not while you are still there.',
    category: 'Online',
    order: 11,
    isPublished: true,
  },
  {
    id: 'tip_12',
    title: 'Screenshot abuse before you block',
    content:
      'Capture the message, the profile, and the URL first. Once you block or the sender deletes the account, that evidence is much harder to recover for a cyber-crime complaint.',
    category: 'Online',
    order: 12,
    isPublished: true,
  },
  {
    id: 'tip_13',
    title: 'Learn where the police stations near you are',
    content:
      'Check the map for the two or three stations closest to your home, workplace, and regular routes. Knowing the direction to walk saves critical minutes.',
    category: 'General',
    order: 13,
    isPublished: true,
  },
  {
    id: 'tip_14',
    title: 'Keep your phone above 30 percent when out',
    content:
      'Carry a small power bank. Surakshak sends a low-battery alert to your contacts, but a charged phone keeps SOS, calls, and location working when you need them most.',
    category: 'General',
    order: 14,
    isPublished: true,
  },
  {
    id: 'tip_15',
    title: 'Agree on a code word with your family',
    content:
      'Pick a normal-sounding phrase that means "come get me" or "call the police". You can use it on a call or text even when someone is listening or watching.',
    category: 'General',
    order: 15,
    isPublished: true,
  },
];

const NEWS = [
  {
    id: 'news_1',
    title: 'Surakshak App Launches for Women Safety in India',
    summary:
      'A new mobile app designed to enhance women safety with SOS, live location, and community features.',
    content:
      'Surakshak is a new women safety application built by the REDX Club. It brings together one-tap SOS alerts, live location sharing with trusted contacts, safe-journey check-ins, a community feed for local safety updates, and an offline library of laws, FAQs, and safety tips. The app works on a low-cost Android phone and sends SMS alerts over the device SIM so help can be summoned even on a weak connection.',
    imageUrl: '',
    category: 'App News',
    publishedAt: now,
    isPublished: true,
  },
  {
    id: 'news_2',
    title: '112 Emergency Number Now Available Across All States',
    summary: 'The unified emergency number 112 is now operational across all Indian states.',
    content:
      'The government has successfully rolled out the 112 emergency number nationwide. A single call to 112 now connects to police, fire, and ambulance services, and can be reached from a locked phone or without a SIM. States have integrated 112 with their Emergency Response Support System control rooms, and a panic call can also be triggered by pressing the power button three times on many phones.',
    imageUrl: '',
    category: 'Safety News',
    publishedAt: now - DAY_MS,
    isPublished: true,
  },
  {
    id: 'news_3',
    title: 'Women Safety Index 2024 — Maharashtra Ranks 3rd',
    summary: 'Maharashtra has improved its women safety ranking in the annual national index.',
    content:
      'According to the National Crime Records Bureau and independent safety surveys, Maharashtra has moved up to third place in the 2024 women safety index. Analysts credit faster FIR registration, more women help desks at police stations, and wider CCTV coverage in major cities. Rural districts still lag on response times, which the state says it will address with more dedicated women-safety patrols.',
    imageUrl: '',
    category: 'India News',
    publishedAt: now - 2 * DAY_MS,
    isPublished: true,
  },
];

async function seedCollection(db, name, docs) {
  console.log(`\nSeeding ${name} (${docs.length} documents)`);
  for (const { id, ...data } of docs) {
    const ref = db.collection(name).doc(id);
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`  skip   ${name}/${id} (already exists)`);
      continue;
    }
    await ref.set(data);
    console.log(`  create ${name}/${id}`);
  }
}

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'surakshak-2869a';
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();

  await seedCollection(db, 'laws', LAWS);
  await seedCollection(db, 'faqs', FAQS);
  await seedCollection(db, 'safetyTips', SAFETY_TIPS);
  await seedCollection(db, 'news', NEWS);

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
