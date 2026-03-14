#!/usr/bin/env node

/**
 * Indian Company ATS Discovery — Greenhouse, Ashby, Lever, Recruitee, Workable
 * Prints EVERY found board so you know which company is on which platform.
 * Usage: node discoverIndia.js
 */

const CONCURRENCY = 8;
const BATCH_DELAY_MS = 1500;
const TIMEOUT_MS = 10000;

// ─────────────────────────────────────────────────────────────────────────────
// ~1000+ INDIAN COMPANY SLUGS
// ─────────────────────────────────────────────────────────────────────────────
const companySlugs = [

  // ── UNICORNS / DECACORNS ──────────────────────────────────────────────────
  'razorpay','razorpaysoftware','razorpay-software',
  'cred','cred-club','credclub',
  'meesho','meesho-tech','meeshotech',
  'groww','groww-in',
  'zerodha','zerodha-tech',
  'phonepe','phonepe-tech','phonepetech',
  'swiggy','swiggy-tech',
  'zomato','zomato-tech',
  'flipkart','flipkart-tech',
  'paytm','one97','paytm-tech',
  'ola','olacabs','ola-electric','olaelectric',
  'byjus','thinkandlearn','think-and-learn',
  'oyo','oyorooms','oyo-tech',
  'dream11','dreamsports','dream-sports',
  'delhivery','delhivery-tech',
  'nykaa','nykaatech','fsn-ecommerce',
  'udaan','udaantech',
  'bharatpe','bharatpetech',
  'slice','slicefintech','slice-fintech',
  'jupiter-money','jupitermoney',
  'epifi','fi-money',
  'curefit','cultfit','cure-fit',
  'lenskart','lenskarttech',
  'boat-lifestyle','imagine-marketing',
  'urbancompany','urbanclap','urban-clap',
  'unacademy','unacademytech',
  'vedantu','vedantutech',
  'physicswallah','pw','pw-tech',
  'upgrad','upgradtech',
  'zepto','zeptotech',
  'blinkit','blinkitech',
  'dunzo','dunzotech',
  'rapido','rapidobike','rapido-bike',
  'myntra','myntratech',
  'makemytrip','mmt','make-my-trip',
  'ixigo',
  'cleartrip',
  'cars24',
  'spinny',
  'acko','acko-insurance',
  'nobroker',
  'housing','housingcom',
  'magicbricks',
  'practo',
  'pharmeasy',
  'tata-1mg','tata1mg',
  'apna','apnatech',
  'sharechat','verseinnovation',
  'dailyhunt',
  'licious',
  'bigbasket','big-basket',
  'countrydelight',
  'ninjacart',
  'dealshare',
  'khatabook',
  'mobikwik',
  'policybazaar','pbfintech',
  'pepperfry',
  'snapdeal',
  'firstcry',
  'honasa','mamaearth',
  'bewakoof',
  'wakefit',
  'purplle',
  'mpl',
  'winzo','winzo-games',

  // ── SAAS / TECH PRODUCT ───────────────────────────────────────────────────
  'freshworks','freshworks-inc','freshdesk','freshsales','freshservice',
  'zoho','zohocorp','zoho-corp',
  'chargebee','chargebee-inc',
  'postman','postmantech',
  'hasura','hasuratech',
  'browserstack','browserstacktech',
  'lambdatest',
  'clevertap','clevertaptech',
  'moengage','moengagetech',
  'webengage',
  'leadsquared',
  'darwinbox','darwinboxtech',
  'keka','kekahr',
  'greythr','greytip',
  'haptik','haptiktech',
  'yellowai','yellow-messenger','yellowmessenger',
  'gupshup',
  'verloop',
  'whatfix',
  'mindtickle','mindtickletech',
  'icertis',
  'druva','druvatech',
  'netcore-cloud','netcorecloud',
  'exotel',
  'sprinklr',
  'capillary','capillarytech',
  'kissflow',
  'rocketlane',
  'hevodata','hevo','hevo-data',
  'sigmoid','sigmoidanalytics',
  'tredence','tredence-analytics',
  'fractal','fractalanalytics','fractal-ai',
  'musigma','mu-sigma',
  'latentview','latent-view-analytics',
  'tigeranalytics','tiger-analytics',
  'inmobi','inmobitech',
  'medianet','media-net',
  'glance','glance-inmobi',
  'smallcase',
  'kuvera',
  'upstox','upstoxtech',
  'angelone','angel-broking',
  'juspay','juspaytech',
  'setu',
  'decentro',
  'cashfree','cashfreepayments',
  'instamojo',
  'signzy',
  'perfios',
  'hyperverge',
  'getsimpl',
  'goniyo','niyo',
  'zeta','zetasuit',
  'recko',
  'fyle','fylehq',
  'servify',
  'classplus',
  'teachmint',
  'doubtnut',
  'toppr',
  'embibe',
  'testbook',
  'scaler','scaleracademy','interviewbit',
  'codingninjas',
  'masai-school','masaischool',
  'newton-school','newtonschool',
  'pesto','pestotech',
  'almabetter',
  'crio-do','criodo',
  'nxtwave',
  'unstop','dare2compete',
  'devfolio',
  'workindia',
  'apnaklub',
  'peoplestrong','people-strong',
  'sumhr',
  'kredily',
  'zimyo',
  'qandle',
  'akrivia',

  // ── IT SERVICES / CONSULTING ──────────────────────────────────────────────
  'nagarro','nagarrotech',
  'xoriant',
  'talentica',
  'mphasis',
  'ltimindtree','lti-mindtree','lti','mindtree',
  'coforge',
  'zensar','zensartech',
  'persistent-systems','persistentsystems',
  'birlasoft',
  'sonatasoftware','sonata-software',
  'cyient',
  'happiestminds','happiest-minds',
  'mastek',
  'newgen-software','newgensoftware',
  'cigniti',
  'indiumsoftware','indium-software',
  'kellton',
  'datamatics',
  'prodapt',
  'subex',
  'sasken',
  'intellectdesign','intellect-design',
  'nucleussoftware','nucleus-software',
  'ramco-systems','ramco',
  'globallogic',
  'amdocs',
  'hexaware','hexawaretech',
  'kpit','kpit-tech',
  'firstsource',
  'wns','wns-global',
  'ltts','lt-technology-services',
  'tata-elxsi','tataelxsi',
  'tata-technologies','tatatechnologies',
  'hashedin','hashedintech',
  'radixweb',
  'simform',
  'einfochips',
  'crestdata','crest-data',
  'tatvasoft',
  'azilen',
  'rapidops',
  'argusoft',
  'appinventiv',
  'hyperlink-infosystem',
  'konstant',
  'mindinventory',
  'openxcell',
  'bacancy',
  'marutitechlabs',
  'cuelogic',
  'velotio',
  'synerzip',
  'harbinger-group',
  'quantiphi',
  'gramener',
  'dataweave',
  'crayondata',
  'flutura',
  'bridgei2i',
  'manthan',
  'algonomy',
  'absolutdata',
  'talentneuron',
  'epam','epam-india',
  'publicis-sapient','publicissapient',
  'thoughtworks-india',

  // ── FINTECH / PAYMENTS ────────────────────────────────────────────────────
  'payu','payu-india',
  'pinelabs','pine-labs',
  'innoviti',
  'rupeek',
  'lendingkart',
  'navi-tech','navi-finserv',
  'mswipe',
  'ezetap',
  'worldline-india',
  'bankopen','open-financial',
  'indifi',
  'tartanhq',
  'credavenue','cred-avenue',
  'northernarc',
  'vivriti',
  'finbox',
  'yubi',
  'zaggle',
  'moneytap',
  'stashfin',
  'kreditbee',
  'moneyview',
  'truebalance',
  'zestmoney',
  'kissht',
  'earlysalary','fibe',
  'onecard','one-card',
  'unicards','uni-cards',
  'freecharge',
  'moneyfwd',
  'bharatx',
  'refyne',
  'ftcash',
  'freo',
  'avail-finance',
  'benow',
  'ditto-insurance',
  'plum-hq',
  'nova-benefits',
  'digit-insurance','go-digit',
  'policyx',
  'renewbuy',
  'paytmmoney',

  // ── HEALTHTECH ────────────────────────────────────────────────────────────
  'mfine',
  'pristyncare',
  'healthifyme',
  'niramai',
  'qureai',
  'sigtuple',
  'tricog',
  'innovaccer',
  'ekincare',
  'netmeds',
  'apollo247',
  'amaha',
  'wysa',
  'healthians',
  'thyrocare',
  'docplexus',
  'mojocare',
  'curelink',
  'zyla',
  'predible',
  'portea','portea-medical',
  'tatahealth','tata-health',
  'bajaj-health',
  'care-health',
  'eka-care',
  'meddco',
  'clinikk',

  // ── D2C / ECOMMERCE ───────────────────────────────────────────────────────
  'ajio',
  'tatacliq','tata-cliq',
  'urbanladder',
  'sugarcosmetics',
  'plum-goodness',
  'noise-tech','gonoise',
  'bluestone',
  'caratlane',
  'melorra',
  'yatra',
  'goibibo',
  'treebo',
  'fabhotels',
  'zostel',
  'clovia',
  'wowskinscience',
  'portronics',
  'zebronics',
  'boult','boult-audio',
  'jiomart',
  'reliance-retail',
  'milkbasket',
  'suprdaily',
  'jumbotail',
  'shopkirana',
  'fashinza',
  'bikayi',
  'dukaan',
  'vinculum',
  'unicommerce',
  'zivame',
  'fabindia',
  'fireboltt',
  'titan-company',
  'firstcry-tech',

  // ── LOGISTICS / MOBILITY ──────────────────────────────────────────────────
  'shiprocket',
  'ecomexpress','ecom-express',
  'shadowfax',
  'loadshare',
  'rivigo',
  'blackbuck',
  'porter',
  'vahak',
  'cogoport',
  'locus',
  'fareye',
  'loginext',
  'shipsy',
  'pickrr',
  'elasticrun',
  'magicpin',
  'parkplus',
  'blowhorn',
  'freightwalla',
  'nammayatri',
  'yulu',
  'drivezy',
  'zoomcar',
  'bounce',
  'chalo',
  'cityflo',
  'shuttl',
  'nuego',
  'ati-motors',
  'euler-motors',
  'battery-smart',
  'altigreen',

  // ── AI / DEEPTECH / SPACETECH ─────────────────────────────────────────────
  'sarvam','sarvamai','sarvam-ai',
  'krutrim','krutrim-ai',
  'wadhwani-ai','wadhwaniai',
  'agnikul','agnikul-cosmos',
  'skyroot','skyroot-aerospace',
  'pixxel','pixxel-space',
  'bellatrix','bellatrix-aerospace',
  'dhruva-space','dhruvaspace',
  'vernacular-ai','vernacularai',
  'gnani-ai','gnaniai',
  'arya-ai','aryaai',
  'fluid-ai','fluidai',
  'entropik',
  'e42','e42-ai',
  'niki-ai','nikiai',
  'mygate',
  'cropin',
  'agrostar',
  'bijak',
  'waycool',
  'stellapps',
  'staqu',
  'tessact',
  'detect-technologies',
  'ignitarium',
  'mirafra',
  'tvarit',
  'altizon',
  'prescinto',
  'yotta','yotta-infrastructure',

  // ── EV / CLEAN ENERGY ─────────────────────────────────────────────────────
  'ather-energy','atherenergy',
  'revolt-motors',
  'ultraviolette',
  'tork-motors',
  'simpleenergy',
  'log9','log9-materials',
  'exponent-energy','exponentenergy',
  'ion-energy','ionenergy',
  'lohum','lohum-cleantech',
  'grinntech',
  'zunroof',
  'fourth-partner','fourthpartner',
  'hero-electric','heroelectric',
  'ampere-vehicles','ampere',
  'okinawa-scooters',
  'batx-energies',
  'sterling-wilson',
  'amplus-solar',
  'ayana-renewable',
  'greenko',
  'acme-solar',

  // ── EDTECH / GAMING / MEDIA ───────────────────────────────────────────────
  'whitehat','whitehatjr',
  'simplilearn',
  'greatlearning','great-learning',
  'eruditus',
  'emeritus',
  'cuemath',
  'extramarks',
  'adda247',
  'allen-digital','allendigital',
  'aakash-digital','aakash',
  'leverage-edu','leverageedu',
  'collegedunia',
  'shiksha',
  'careers360',
  'infoedge','info-edge',
  'timesinternet','times-internet',
  'nazara','nazara-tech',
  'gameskraft',
  'games24x7',
  'kukufm','kuku-fm',
  'pocketfm','pocket-fm',
  'pratilipi',
  'koo','koo-app',
  'josh-app',
  'chingari',
  'roposo',
  'trell',
  'peppercontent','pepper-content',
  'stage-app',
  'hungama',
  'gaana',
  'jiosavan',
  'wynk',
  'zee5','zee5-tech',
  'sonyliv',
  'mxplayer',
  'hoichoi',
  'inshorts',
  'vidooly',
  'gradeup',

  // ── LARGE INDIAN CONGLOMERATES / IT ───────────────────────────────────────
  'tata-communications','tatacomm',
  'tata-digital','tatadigital',
  'tatamotors',
  'mahindra-tech','mtech',
  'bajaj-finserv','bajajfinserv',
  'infosys','infosys-tech',
  'wipro','wipro-tech',
  'hcl-technologies','hcltech',
  'tech-mahindra','techmahindra',
  'tcs','tata-consultancy',
  'tata-elxsi',
  'ltts-india',
  'quick-heal','quickheal',
  'tally-solutions','tallysolutions',
  'sap-labs-india','saplabs',

  // ── BANKING / FINANCIAL SERVICES ─────────────────────────────────────────
  'hdfcbank','hdfc-bank-tech',
  'icicibank','icici-bank-tech',
  'axisbank','axis-bank-tech',
  'kotak-tech','kotak',
  'idfcfirst','idfc-first',
  'aubank','au-bank',
  'rbl-bank',
  'bajaj-housing',
  'pnb-housing',
  'iifl-finance','iifl',
  'shriram-finance',
  'muthoot-finance',
  'ugro-capital',
  'piramal-finance',
  'abcl','aditya-birla-finance',
  'maxlife','max-life',
  'hdfclife','hdfc-life',

  // ── PROPTECH / REAL ESTATE ────────────────────────────────────────────────
  'proptiger',
  '99acres',
  'quikr',
  'nestaway',
  'stanza-living',
  'colive',
  'squareyards','square-yards',
  'anarock',
  'commonfloor',

  // ── AGRITECH / FOODTECH ───────────────────────────────────────────────────
  'dehaat',
  'intello-labs',
  'samunnati',
  'freshtohome','fresh-to-home',
  'rebel-foods','faasos',
  'dotpe',
  'eatsure',
  'wingreens-farms',
  'the-good-glamm',

  // ── HRTECH / WORKTECH ────────────────────────────────────────────────────
  'springworks','spring-works',
  'skuad','skuad-global',
  'multiplier-hq','multiplier',
  'razorpayx',
  'open-payroll',
  'pocket-hrms',
  'spine-hr',
  'hrmantra',
  'beehive-hrms',

  // ── LEGALTECH / REGTECH ──────────────────────────────────────────────────
  'leegality',
  'vakilno1','vakil-no1',
  'myoperator',
  'signdesk',
  'digio',

  // ── TRAVELTECH / HOSPITALITY ─────────────────────────────────────────────
  'easetotrip',
  'confirmtkt',
  'railyatri',
  'yatra-online',
  'thomas-cook-india',
  'treebo-hotels',
  'fabhotels-tech',
  'zostel-tech',

];

// ─────────────────────────────────────────────────────────────────────────────
// India detection
// ─────────────────────────────────────────────────────────────────────────────
const indianCities = [
  'bangalore','bengaluru','mumbai','delhi','new delhi',
  'hyderabad','pune','chennai','noida','gurgaon','gurugram',
  'kolkata','ahmedabad','jaipur','lucknow','chandigarh',
  'indore','nagpur','coimbatore','kochi','cochin',
  'thiruvananthapuram','trivandrum','visakhapatnam','vizag',
  'bhubaneswar','mangalore','mysore','mysuru','vadodara',
  'surat','patna','ranchi','guwahati','bhopal',
];

function hasIndia(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (t.includes('india')) return true;
  return indianCities.some(c => t.includes(c));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    clearTimeout(tid);
    return res;
  } catch (e) { clearTimeout(tid); throw e; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform testers
// ─────────────────────────────────────────────────────────────────────────────
async function testGreenhouse(slug) {
  try {
    const res = await fetchWithTimeout(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const jobs = data.jobs || [];
    const india = jobs.filter(j => hasIndia(j.location?.name)).length;
    return { slug, platform: 'greenhouse', total: jobs.length, india };
  } catch { return null; }
}

async function testAshby(slug) {
  try {
    const res = await fetchWithTimeout(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const jobs = data.jobs || [];
    const india = jobs.filter(j => {
      if (hasIndia(j.location)) return true;
      const c = j.address?.postalAddress?.addressCountry || '';
      if (c === 'IN' || c === 'IND' || hasIndia(c)) return true;
      return (j.secondaryLocations || []).some(sl =>
        hasIndia(sl.location) || sl.address?.addressCountry === 'IN'
      );
    }).length;
    return { slug, platform: 'ashby', total: jobs.length, india };
  } catch { return null; }
}

async function testLever(slug) {
  try {
    const res = await fetchWithTimeout(
      `https://api.lever.co/v0/postings/${slug}?mode=json`
    );
    if (!res.ok) return null;
    const jobs = await res.json();
    if (!Array.isArray(jobs)) return null;
    const india = jobs.filter(j => {
      const c = (j.country || '').toLowerCase();
      if (c === 'in' || c === 'ind' || c === 'india') return true;
      if (hasIndia(j.categories?.location)) return true;
      return (j.categories?.allLocations || []).some(l => hasIndia(l));
    }).length;
    return { slug, platform: 'lever', total: jobs.length, india };
  } catch { return null; }
}

async function testRecruitee(slug) {
  try {
    const res = await fetchWithTimeout(
      `https://${slug}.recruitee.com/api/offers/`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const offers = data.offers || [];
    const india = offers.filter(o =>
      (o.locations || []).some(loc =>
        loc.country_code === 'IN' ||
        loc.country?.toLowerCase() === 'india' ||
        hasIndia(loc.country) ||
        hasIndia(loc.city)
      )
    ).length;
    return { slug, platform: 'recruitee', total: offers.length, india };
  } catch { return null; }
}

async function testWorkable(slug) {
  try {
    const res = await fetchWithTimeout(
      `https://apply.workable.com/api/v1/widget/accounts/${slug}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const jobs = data.jobs || [];
    const india = jobs.filter(j => {
      const c = (j.country || '').toLowerCase();
      if (c === 'india' || c === 'in') return true;
      if (hasIndia(j.city)) return true;
      return (j.locations || []).some(l =>
        l.country_code === 'IN' || hasIndia(l.country) || hasIndia(l.city)
      );
    }).length;
    return { slug, platform: 'workable', total: jobs.length, india };
  } catch { return null; }
}

async function testSlug(slug) {
  const [gh, ash, lev, rec, wrk] = await Promise.all([
    testGreenhouse(slug),
    testAshby(slug),
    testLever(slug),
    testRecruitee(slug),
    testWorkable(slug),
  ]);
  return [gh, ash, lev, rec, wrk].filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const uniqueSlugs = [...new Set(companySlugs)];
  const startTime = Date.now();

  console.log(`\n🔍 Testing ${uniqueSlugs.length} Indian slugs × 5 platforms (${CONCURRENCY} parallel)\n`);

  const platforms = {
    greenhouse: { found: [], india: [] },
    ashby:      { found: [], india: [] },
    lever:      { found: [], india: [] },
    recruitee:  { found: [], india: [] },
    workable:   { found: [], india: [] },
  };

  for (let i = 0; i < uniqueSlugs.length; i += CONCURRENCY) {
    const batch = uniqueSlugs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(testSlug));

    for (const results of batchResults) {
      for (const r of results) {
        const p = platforms[r.platform];
        p.found.push(r);
        if (r.india > 0) {
          p.india.push(r);
          console.log(`  ✅ [${r.platform.toUpperCase().padEnd(10)}] ${r.slug}: ${r.india} India / ${r.total} total`);
        }
      }
    }

    const done = Math.min(i + CONCURRENCY, uniqueSlugs.length);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const totalIndia = Object.values(platforms).reduce((s, p) => s + p.india.length, 0);
    const totalFound = Object.values(platforms).reduce((s, p) => s + p.found.length, 0);
    process.stdout.write(
      `\r  [${done}/${uniqueSlugs.length}] ${elapsed}s | found: ${totalFound} | 🇮🇳 india: ${totalIndia}   `
    );

    if (i + CONCURRENCY < uniqueSlugs.length) await sleep(BATCH_DELAY_MS);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── PER-PLATFORM BREAKDOWN ────────────────────────────────────────────────
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log(`📊 RESULTS (${totalTime}s) — ${uniqueSlugs.length} slugs × 5 platforms`);
  console.log(`${'═'.repeat(70)}`);

  for (const [name, data] of Object.entries(platforms)) {
    console.log(`\n  ${name.toUpperCase()}: ${data.found.length} live boards | ${data.india.length} with India jobs`);

    if (data.found.length > 0) {
      console.log(`  ${'─'.repeat(60)}`);
      const sorted = [...data.found].sort((a, b) => {
        if (b.india !== a.india) return b.india - a.india;
        return b.total - a.total;
      });
      for (const r of sorted) {
        const flag  = r.india > 0 ? `🇮🇳 ${r.india}` : `   0`;
        const pad   = ' '.repeat(Math.max(1, 36 - r.slug.length));
        console.log(`    ${r.slug}${pad}${flag} India / ${r.total} total`);
      }
    }
  }

  // ── COPY-READY: INDIA JOBS ONLY ───────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 PASTE INTO CONFIG FILES (India jobs only):`);
  console.log(`${'═'.repeat(70)}`);

  const configMap = {
    greenhouse: 'greenhouseConfig.js — companyBoardTokens',
    ashby:      'ashbyConfig.js    — companyBoardNames',
    lever:      'leverConfig.js    — companySiteNames',
    recruitee:  'recruiteeConfig.js — companySlugs',
    workable:   'workableConfig.js  — companySlugs',
  };

  for (const [name, data] of Object.entries(platforms)) {
    if (data.india.length === 0) continue;
    console.log(`\n// ${configMap[name]}:`);
    for (const r of [...data.india].sort((a, b) => b.india - a.india)) {
      const pad = ' '.repeat(Math.max(1, 36 - r.slug.length));
      console.log(`  '${r.slug}',${pad}// ${r.india} India jobs`);
    }
  }

  // ── ALL FOUND (any platform) ──────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 ALL FOUND BOARDS (every slug that responded on any platform):`);
  console.log(`${'═'.repeat(70)}`);

  const allFound = new Map();
  for (const [name, data] of Object.entries(platforms)) {
    for (const r of data.found) {
      if (!allFound.has(r.slug)) allFound.set(r.slug, []);
      allFound.get(r.slug).push(`${name}(${r.total}jobs,${r.india}IN)`);
    }
  }

  for (const [slug, plats] of [...allFound.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pad = ' '.repeat(Math.max(1, 38 - slug.length));
    console.log(`  ${slug}${pad}${plats.join(' | ')}`);
  }

  console.log('');
}

main();