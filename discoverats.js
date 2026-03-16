#!/usr/bin/env node

/**
 * Workday Career Site Discovery
 * Tests 2000+ company slugs against Workday's undocumented /wday/cxs/ JSON API.
 * Tries multiple instance×site combos per slug. Filters for India jobs.
 *
 * Usage: node discoverWorkday.js
 *
 * Endpoint: POST https://{slug}.{instance}.myworkdayjobs.com/wday/cxs/{slug}/{site}/jobs
 * Body:     { appliedFacets: {}, limit: 20, offset: 0, searchText: "" }
 */

const CONCURRENCY = 6;
const BATCH_DELAY_MS = 1800;
const TIMEOUT_MS = 8000;

// ─────────────────────────────────────────────────────────────────────────────
// Instance × site combos to try (ordered by likelihood — stop on first hit)
// ─────────────────────────────────────────────────────────────────────────────
const FAST_COMBOS = [
  ['wd1','External'],['wd1','Careers'],['wd1','External_Careers'],['wd1','Jobs'],
  ['wd5','External'],['wd5','Careers'],['wd5','External_Careers'],['wd5','Jobs'],
  ['wd3','External'],['wd3','Careers'],['wd3','External_Careers'],['wd3','Jobs'],
  ['wd12','External'],['wd12','Careers'],['wd12','External_Careers'],
  ['wd2','External'],['wd2','Careers'],
  ['wd4','External'],['wd4','Careers'],
  ['wd1','en-US'],['wd5','en-US'],['wd3','en-US'],
  ['wd1','ExternalCareerSite'],['wd5','ExternalCareerSite'],
  ['wd1','job'],['wd5','job'],
];

// ─────────────────────────────────────────────────────────────────────────────
// 2000+ COMPANY SLUGS
// ─────────────────────────────────────────────────────────────────────────────
const companySlugs = [

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 1 — ALL ORIGINAL INDIAN SLUGS (kept exactly)
  // ══════════════════════════════════════════════════════════════════════════

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
  'ixigo','cleartrip','cars24','spinny',
  'acko','acko-insurance',
  'nobroker','housing','housingcom','magicbricks',
  'practo','pharmeasy','tata-1mg','tata1mg',
  'apna','apnatech',
  'sharechat','verseinnovation','dailyhunt',
  'licious','bigbasket','big-basket','countrydelight',
  'ninjacart','dealshare','khatabook','mobikwik',
  'policybazaar','pbfintech',
  'pepperfry','snapdeal','firstcry',
  'honasa','mamaearth','bewakoof','wakefit','purplle',
  'mpl','winzo','winzo-games',

  // ── SAAS / TECH PRODUCT ───────────────────────────────────────────────────
  'freshworks','freshworks-inc','freshdesk','freshsales','freshservice',
  'zoho','zohocorp','zoho-corp',
  'chargebee','chargebee-inc',
  'postman','postmantech',
  'hasura','hasuratech',
  'browserstack','browserstacktech',
  'lambdatest','clevertap','clevertaptech',
  'moengage','moengagetech','webengage','leadsquared',
  'darwinbox','darwinboxtech',
  'keka','kekahr','greythr','greytip',
  'haptik','haptiktech',
  'yellowai','yellow-messenger','yellowmessenger',
  'gupshup','verloop','whatfix',
  'mindtickle','mindtickletech',
  'icertis','druva','druvatech',
  'netcore-cloud','netcorecloud',
  'exotel','sprinklr','capillary','capillarytech',
  'kissflow','rocketlane',
  'hevodata','hevo','hevo-data',
  'sigmoid','sigmoidanalytics',
  'tredence','tredence-analytics',
  'fractal','fractalanalytics','fractal-ai',
  'musigma','mu-sigma',
  'latentview','latent-view-analytics',
  'tigeranalytics','tiger-analytics',
  'inmobi','inmobitech','medianet','media-net',
  'glance','glance-inmobi',
  'smallcase','kuvera','upstox','upstoxtech',
  'angelone','angel-broking',
  'juspay','juspaytech','setu','decentro',
  'cashfree','cashfreepayments','instamojo',
  'signzy','perfios','hyperverge','getsimpl',
  'goniyo','niyo','zeta','zetasuit','recko',
  'fyle','fylehq','servify',
  'classplus','teachmint','doubtnut','toppr','embibe','testbook',
  'scaler','scaleracademy','interviewbit',
  'codingninjas','masai-school','masaischool',
  'newton-school','newtonschool',
  'pesto','pestotech','almabetter',
  'crio-do','criodo','nxtwave',
  'unstop','dare2compete','devfolio','workindia',
  'apnaklub','peoplestrong','people-strong',
  'sumhr','kredily','zimyo','qandle','akrivia',

  // ── IT SERVICES / CONSULTING ──────────────────────────────────────────────
  'nagarro','nagarrotech','xoriant','talentica','mphasis',
  'ltimindtree','lti-mindtree','lti','mindtree',
  'coforge','zensar','zensartech',
  'persistent-systems','persistentsystems',
  'birlasoft','sonatasoftware','sonata-software',
  'cyient','happiestminds','happiest-minds',
  'mastek','newgen-software','newgensoftware',
  'cigniti','indiumsoftware','indium-software',
  'kellton','datamatics','prodapt','subex','sasken',
  'intellectdesign','intellect-design',
  'nucleussoftware','nucleus-software',
  'ramco-systems','ramco',
  'globallogic','amdocs','hexaware','hexawaretech',
  'kpit','kpit-tech',
  'firstsource','wns','wns-global',
  'ltts','lt-technology-services',
  'tata-elxsi','tataelxsi','tata-technologies','tatatechnologies',
  'hashedin','hashedintech',
  'radixweb','simform','einfochips','crestdata','crest-data',
  'tatvasoft','azilen','rapidops','argusoft',
  'appinventiv','hyperlink-infosystem','konstant',
  'mindinventory','openxcell','bacancy',
  'marutitechlabs','cuelogic','velotio','synerzip',
  'harbinger-group','quantiphi','gramener',
  'dataweave','crayondata','flutura','bridgei2i',
  'manthan','algonomy','absolutdata','talentneuron',
  'epam','epam-india','publicis-sapient','publicissapient',
  'thoughtworks-india',

  // ── FINTECH / PAYMENTS ────────────────────────────────────────────────────
  'payu','payu-india','pinelabs','pine-labs','innoviti',
  'rupeek','lendingkart','navi-tech','navi-finserv',
  'mswipe','ezetap','worldline-india',
  'bankopen','open-financial','indifi','tartanhq',
  'credavenue','cred-avenue','northernarc','vivriti',
  'finbox','yubi','zaggle','moneytap','stashfin',
  'kreditbee','moneyview','truebalance','zestmoney','kissht',
  'earlysalary','fibe','onecard','one-card',
  'unicards','uni-cards','freecharge','moneyfwd',
  'bharatx','refyne','ftcash','freo','avail-finance',
  'benow','ditto-insurance','plum-hq','nova-benefits',
  'digit-insurance','go-digit','policyx','renewbuy','paytmmoney',

  // ── HEALTHTECH ────────────────────────────────────────────────────────────
  'mfine','pristyncare','healthifyme','niramai','qureai',
  'sigtuple','tricog','innovaccer','ekincare','netmeds',
  'apollo247','amaha','wysa','healthians','thyrocare',
  'docplexus','mojocare','curelink','zyla','predible',
  'portea','portea-medical','tatahealth','tata-health',
  'bajaj-health','care-health','eka-care','meddco','clinikk',

  // ── D2C / ECOMMERCE ───────────────────────────────────────────────────────
  'ajio','tatacliq','tata-cliq','urbanladder','sugarcosmetics',
  'plum-goodness','noise-tech','gonoise','bluestone','caratlane',
  'melorra','yatra','goibibo','treebo','fabhotels','zostel',
  'clovia','wowskinscience','portronics','zebronics',
  'boult','boult-audio','jiomart','reliance-retail',
  'milkbasket','suprdaily','jumbotail','shopkirana',
  'fashinza','bikayi','dukaan','vinculum','unicommerce',
  'zivame','fabindia','fireboltt','titan-company','firstcry-tech',

  // ── LOGISTICS / MOBILITY ──────────────────────────────────────────────────
  'shiprocket','ecomexpress','ecom-express','shadowfax','loadshare',
  'rivigo','blackbuck','porter','vahak','cogoport','locus',
  'fareye','loginext','shipsy','pickrr','elasticrun',
  'magicpin','parkplus','blowhorn','freightwalla','nammayatri',
  'yulu','drivezy','zoomcar','bounce','chalo','cityflo',
  'shuttl','nuego','ati-motors','euler-motors','battery-smart','altigreen',

  // ── AI / DEEPTECH / SPACETECH ─────────────────────────────────────────────
  'sarvam','sarvamai','sarvam-ai','krutrim','krutrim-ai',
  'wadhwani-ai','wadhwaniai','agnikul','agnikul-cosmos',
  'skyroot','skyroot-aerospace','pixxel','pixxel-space',
  'bellatrix','bellatrix-aerospace','dhruva-space','dhruvaspace',
  'vernacular-ai','vernacularai','gnani-ai','gnaniai',
  'arya-ai','aryaai','fluid-ai','fluidai','entropik',
  'e42','e42-ai','niki-ai','nikiai',
  'mygate','cropin','agrostar','bijak','waycool','stellapps',
  'staqu','tessact','detect-technologies','ignitarium','mirafra',
  'tvarit','altizon','prescinto','yotta','yotta-infrastructure',

  // ── EV / CLEAN ENERGY ─────────────────────────────────────────────────────
  'ather-energy','atherenergy','revolt-motors','ultraviolette',
  'tork-motors','simpleenergy','log9','log9-materials',
  'exponent-energy','exponentenergy','ion-energy','ionenergy',
  'lohum','lohum-cleantech','grinntech','zunroof',
  'fourth-partner','fourthpartner','hero-electric','heroelectric',
  'ampere-vehicles','ampere','okinawa-scooters','batx-energies',
  'sterling-wilson','amplus-solar','ayana-renewable','greenko','acme-solar',

  // ── EDTECH / GAMING / MEDIA ───────────────────────────────────────────────
  'whitehat','whitehatjr','simplilearn','greatlearning','great-learning',
  'eruditus','emeritus','cuemath','extramarks','adda247',
  'allen-digital','allendigital','aakash-digital','aakash',
  'leverage-edu','leverageedu','collegedunia','shiksha','careers360',
  'infoedge','info-edge','timesinternet','times-internet',
  'nazara','nazara-tech','gameskraft','games24x7',
  'kukufm','kuku-fm','pocketfm','pocket-fm','pratilipi',
  'koo','koo-app','josh-app','chingari','roposo','trell',
  'peppercontent','pepper-content','stage-app','hungama','gaana',
  'jiosavan','wynk','zee5','zee5-tech','sonyliv','mxplayer',
  'hoichoi','inshorts','vidooly','gradeup',

  // ── LARGE CONGLOMERATES / IT ──────────────────────────────────────────────
  'tata-communications','tatacomm','tata-digital','tatadigital',
  'tatamotors','mahindra-tech','mtech','bajaj-finserv','bajajfinserv',
  'infosys','infosys-tech','wipro','wipro-tech',
  'hcl-technologies','hcltech','tech-mahindra','techmahindra',
  'tcs','tata-consultancy','tata-elxsi','ltts-india',
  'quick-heal','quickheal','tally-solutions','tallysolutions',
  'sap-labs-india','saplabs',

  // ── BANKING / FINANCE ─────────────────────────────────────────────────────
  'hdfcbank','hdfc-bank-tech','icicibank','icici-bank-tech',
  'axisbank','axis-bank-tech','kotak-tech','kotak',
  'idfcfirst','idfc-first','aubank','au-bank','rbl-bank',
  'bajaj-housing','pnb-housing','iifl-finance','iifl',
  'shriram-finance','muthoot-finance','ugro-capital','piramal-finance',
  'abcl','aditya-birla-finance','maxlife','max-life','hdfclife','hdfc-life',

  // ── PROPTECH / AGRITECH / HRTECH / LEGAL / TRAVEL ────────────────────────
  'proptiger','99acres','quikr','nestaway','stanza-living','colive',
  'squareyards','square-yards','anarock','commonfloor',
  'dehaat','intello-labs','samunnati','freshtohome','fresh-to-home',
  'rebel-foods','faasos','dotpe','eatsure','wingreens-farms','the-good-glamm',
  'springworks','spring-works','skuad','skuad-global',
  'multiplier-hq','multiplier','razorpayx',
  'open-payroll','pocket-hrms','spine-hr','hrmantra','beehive-hrms',
  'leegality','vakilno1','vakil-no1','myoperator','signdesk','digio',
  'easetotrip','confirmtkt','railyatri','yatra-online',
  'thomas-cook-india','treebo-hotels','fabhotels-tech','zostel-tech',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 2 — KNOWN WORKDAY USERS (confirmed slugs from career sites)
  // ══════════════════════════════════════════════════════════════════════════
  'ntst','abbottglobal','abbott','abnb','airbnb',
  'adobecareers','adobe',
  'airbus','americanexpress','amex',
  'bankofamerica','bofa',
  'boeingcareers','boeing',
  'cat','caterpillar',
  'chevron','comcastcareers','comcast',
  'deloitteus','deloitte',
  'dellcareers','dell',
  'disneycareers','disney',
  'gap','gecareers','ge','gevernova','generalmills',
  'gskcareers','gsk',
  'hilton','hiltonglobal',
  'honeywellcareers','honeywell',
  'hpecareers','hpe',
  'ibmcareers','ibm',
  'jnjcareers','jnj',
  'jpmccareers','jpmc','jpmorgan',
  'kraftheinz',
  'lockheedmartincareers','lockheedmartin',
  'lyft',
  'marriottglobal','marriott',
  'medtroniccareers','medtronic',
  'micron','nbcunicareers','nbcuniversal',
  'netflixcareers','netflix',
  'northropgrumman',
  'paypalcareers','paypal',
  'pepsicojobs','pepsico',
  'pfizer','pgcareers','pg',
  'raytheon','rtx',
  'salesforcecareers','salesforce',
  'sanofigenzyme','sanofi',
  'targetcareers','target',
  'thermofishercareers','thermofisher',
  'ubercareers','uber',
  'unilever',
  'verizoncareers','verizon',
  'vmwarecareers','vmware',
  'walmartglobal','walmart',
  'wellsfargojobs','wellsfargo',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 3 — INTERNATIONAL: BIG TECH / SEMICON
  // ══════════════════════════════════════════════════════════════════════════
  'nvidia','nvidiacareers',
  'intel','intelcareers',
  'cisco','ciscocareers',
  'qualcomm','broadcom','amd','amdcareers',
  'texas-instruments','ti',
  'microntechnology','western-digital','westerndigital',
  'seagate','netapp',
  'juniper','junipernetworks',
  'arista','aristanetworks',
  'paloaltonetworks','paloalto',
  'fortinet','crowdstrike','zscaler','okta',
  'servicenow','snowflake','snowflakecomputing',
  'databricks','palantir','splunk','datadog',
  'elastic','confluent','mongodb','hashicorp',
  'cloudflare','akamai','digitalocean','rackspace',
  'tsmc','samsung','samsungcareers',
  'infineon','infineoncareers',
  'stmicro','stmicroelectronics',
  'nxp','nxpcareers','renesas','onsemi',
  'analogdevices','marvell','marvelltech',
  'microchip','microchiptechnology',
  'cadence','cadencecareers',
  'synopsys','synopsyscareers',
  'arm','armcareers',
  'keysight','teradyne','kla',
  'appliedmaterials','lamresearch','asml','asmlcareers',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 4 — INTERNATIONAL: ENTERPRISE SOFTWARE / SAAS
  // ══════════════════════════════════════════════════════════════════════════
  'sap','sapcareers','workday','workiva','coupa','anaplan',
  'zuora','veeva','veevasystems',
  'hubspot','zendesk','twilio','amplitude','launchdarkly',
  'pagerduty','newrelic','dynatrace','appdynamics',
  'docusign','dropbox','box','zoom','zoomvideo',
  'atlassian','asana','figma','canva','miro','airtable',
  'clickup','monday','mondaydotcom','smartsheet','wrike',
  'gitlab','github','jetbrains','snyk','circleci',
  'vercel','netlify',
  'stripe','stripecareers','square','squareup',
  'adyen','adyencareers','plaid','marqeta','affirm',
  'klarna','wise','wisecareers','revolut','revolutcareers',
  'fiserv','fis','fisglobal','globalpayments','worldpay','ncr',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 5 — INTERNATIONAL: CONSULTING / BIG 4
  // ══════════════════════════════════════════════════════════════════════════
  'mckinsey','mckinseycareers',
  'bcg','bostonconsulting','bain','bainandcompany',
  'deloitteglobal','eyglobal','ey','pwcglobal','pwc',
  'kpmgglobal','kpmg',
  'accenture','accenturecareers','capgemini','cognizant',
  'dxctechnology','dxc','atos','nttdata','ntt',
  'fujitsu','fujitsucareers','unisys','cgi','cgicareers',
  'genpact','concentrix','teleperformance','conduent','xerox',
  'boozallen','oliverwyman','marshmclennan',
  'aon','willistowerswatson','wtw','mercer',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 6 — INTERNATIONAL: BANKING / FINANCE / INSURANCE
  // ══════════════════════════════════════════════════════════════════════════
  'goldmansachs','gs','morganstanley','citigroup','citi',
  'usbank','pnc','pncbank','truist','capitalone',
  'ally','allyfinancial','discover','discoverfin',
  'barclays','hsbc','hsbccareers','standardchartered',
  'ubs','deutschebank','bnpparibas','societegenerale',
  'natwest','natwestgroup','lloyds','lloydsbankinggroup',
  'santander','bbva','ing','ingcareers','rabobank','nordea',
  'dbs','dbsbank','dbscareers','ocbc','uob','nomura','mizuho','mufg',
  'macquarie','blackrock','vanguard','statestreet',
  'fidelity','fidelitycareers','charlesschwab','schwab',
  'visa','visacareers','mastercard','mastercardcareers',
  'allianz','axa','axacareers','zurichinsurance','zurich',
  'metlife','prudential','prudentialfinancial','aig','chubb',
  'travelers','hartford','nationwide','progressive',
  'libertymutual','allstate','aflac','unum',
  'lincoln','lincolnfinancial','manulife','sunlife',
  'aviva','swissre','munichre',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 7 — INTERNATIONAL: HEALTHCARE / PHARMA
  // ══════════════════════════════════════════════════════════════════════════
  'unitedhealth','uhg','optum','cigna','thecignagroup',
  'humana','centene','cvs','cvshealth','walgreens','wba',
  'mckesson','cardinalhealth',
  'baxter','becton','bd','stryker',
  'edwards','edwardslifesciences','bostonscientific',
  'zimmerbiomet','intuitive','intuitivesurgical',
  'illumina','danaher','thermofisherscientific',
  'agilent','waters','perkinelmer','revvity',
  'pfizercareers','merckcareers','merck','msd',
  'abbvie','lilly','elilillyco',
  'bms','bristolmyerssquibb','amgen',
  'gilead','gileadcareers','regeneron','vertex','biogen','moderna',
  'novartis','novartiscareers','roche','rochecareers',
  'astrazeneca','astrazenecacareers','novonordisk',
  'takeda','boehringer','boehringeringelheim',
  'bayer','bayercareers','iqvia',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 8 — INTERNATIONAL: RETAIL / CONSUMER / CPG
  // ══════════════════════════════════════════════════════════════════════════
  'walmartcareers','targetcorporation','costco','kroger','albertsons',
  'tesco','tescocareers','carrefour',
  'amazoncareers','amazon','ebay','etsy','shopify','wayfair',
  'nike','nikecareers','adidas','adidascareers',
  'puma','pumacareers','lululemon',
  'pvh','tapestry','lvmh',
  'estee-lauder','esteelauder','loreal','lorealcareers',
  'proctergamble','unileverusa',
  'colgate','colgatepalmolive','reckitt','henkel',
  'nestle','nestlecareers','danone','mars','marsinc',
  'cocacola','cocacolacompany','diageo','abinbev','heineken',
  'starbucks','starbuckscareers',
  'mcdonalds','mcdonaldscareers','yumbrands','yum','chipotle',
  'marriottcareers','hiltonhotels','hyatt','ihg','ihgcareers','accor',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 9 — INTERNATIONAL: AUTO / MANUFACTURING / AERO / DEFENSE
  // ══════════════════════════════════════════════════════════════════════════
  'toyota','toyotana','honda','hondacareers',
  'ford','fordcareers','gm','generalmotors','stellantis',
  'volkswagen','bmw','bmwgroup','mercedes','mercedesbenz','daimler',
  'volvo','volvocars','volvogroup','rivian','lucid','lucidmotors',
  'deere','johndeere','cummins','emerson',
  'siemens','siemenscareers','abb','schneiderelectric','schneider',
  'rockwellautomation','rockwell','johnsoncontrols',
  'carrier','carrierglobal','otis','otisworldwide',
  '3m','3mcareers','dupont','dow','dowchemical',
  'basf','basfcareers','linde','ecolab',
  'bosch','boschglobal','continental','denso','aptiv',
  'lear','learcompany','magna','magnainternational',
  'airbuscareers','lockheedmartinjobs',
  'northropgrummancareers','rtxcareers','generaldynamics',
  'l3harris','bae','baesystems','rollsroyce',
  'safran','thales','thalescareers','leonardo','textron',
  'leidos','saic','caci','parsons','jacobs','jacobscareers',
  'aecom','fluor','kbr','serco',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 10 — INTERNATIONAL: TELECOM / MEDIA / ENERGY / TRANSPORT
  // ══════════════════════════════════════════════════════════════════════════
  'att','attcareers','verizonwireless',
  'tmobile','tmobilecareers','comcastnbc',
  'charter','chartercommunications','lumen','lumencareers',
  'vodafone','vodafonecareers','orange','orangecareers',
  'telefonica','bt','btcareers','telenor','telia','teliacompany',
  'swisscom','spotify','spotifyjobs','thomsonreuters',
  'exxon','exxonmobil','shell','shellcareers','bp','bpcareers',
  'totalenergies','conocophillips',
  'slb','schlumberger','halliburton','bakerhughes',
  'nextera','nexteraenergy','duke','dukeenergy','southerncompany',
  'dominion','dominionenergy','exelon','enbridge','tcenergy',
  'vestas','orsted','iberdrola','enel','engie',
  'enphase','enphasenergy','firstsolar',
  'ups','upscareers','fedex','fedexcareers','dhl','dhlcareers',
  'maersk','dpworld','xpo','xpologistics',
  'jbhunt','ryder','penske','knightswift',
  'delta','deltacareers','united','unitedairlines',
  'americanairlines','southwest','southwestairlines','jetblue',
  'lufthansa','emirates','emiratesgroup','qatarairways',
  'singaporeairlines','airindiacareers',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 11 — INTERNATIONAL: CYBERSEC / AI / FINTECH / CLOUD
  // ══════════════════════════════════════════════════════════════════════════
  'sentinelone','cyberark','sailpoint','varonis',
  'rapid7','qualys','tenable','beyondtrust',
  'proofpoint','mimecast','recordedfuture','trellix',
  'checkpoint','checkpointsw','trendmicro','sophos','tanium',
  'openai','anthropic','deepmind','googledeepmind',
  'mistral','mistralai','cohere','huggingface',
  'stability','stabilityai','characterai','inflection',
  'c3ai','h2o','h2oai','datarobot',
  'scaleai','scale','labelbox','snorkel','snorkelai',
  'anyscale','replicate','together','togetherai',
  'pinecone','weaviate','grammarly','runway','runwayml',
  'jasper','jasperai',
  'brex','ramp','airwallex','nium','rapyd','sofi','upstart',
  'chime','robinhood','coinbase','kraken','binance',
  'ripple','circle','fireblocks','chainalysis',
  'checkout','checkoutdotcom','mollie',
  'billdotcom','bill','tipalti',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 12 — EUROPEAN / APAC / MEA / LATAM
  // ══════════════════════════════════════════════════════════════════════════
  'ericsson','ericssoncareer','nokia','nokiacareers',
  'booking','bookingcareers','trivagocareers',
  'deliveryhero','hellofresh','zalando','zalandocareers',
  'n26','traderepublic','celonis','personiocareers',
  'contentful','flixbus','flixmobility',
  'monzo','starling','starlingbank',
  'uipath','uipathcareers','endava','criteo','dataiku','doctolib',
  'backmarket','philips','philipscareers',
  'randstad','randstadcareers','wolterskluwer',
  'heinekencareers','ikea','ikeacareers',
  'hm','hmgroup','inditex','zara',
  'grab','grabcareers','gojek','gojekcareers',
  'sea','seagroup','shopee','traveloka','coupang',
  'kakao','kakaocareers','naver','navercareers',
  'mercari','rakuten','rakutencareers',
  'softbank','softbankcareers','hitachi','hitachicareers',
  'singtel','singtelcareers',
  'aramco','sabic','adnoc','emiratesairline',
  'careem','noon','flutterwave','paystack','andela','jumia',
  'mercadolibre','nubank','rappi','ifood',
  'stone','stonecareers','globant','vtex','totvs','kavak',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 13 — REAL ESTATE / GAMING / EDUCATION / MISC
  // ══════════════════════════════════════════════════════════════════════════
  'cbre','cbrecareers','jll','jllcareers',
  'cushmanwakefield','colliers','brookfield',
  'prologis','equinix','equinixcareers','digitalrealty',
  'wework','procore','autodesk','autodeskcareers',
  'ea','electronicarts','activision','activisionblizzard',
  'ubisoft','epicgames','epic','roblox','unity','unitycareers',
  'take2','taketwo','riotgames','riot','zynga','supercell',
  'coursera','udemy','edx','pluralsight',
  'duolingo','duolingocareers',
  'pearson','pearsoncareers','mcgrawhill',
  'wiley','wileycareers','elsevier','elseviercareers',
  'relx','relxgroup','gartner','gartnercareers','forrester',


  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 14 — MORE INTERNATIONAL (to exceed 2000 unique slugs)
  // ══════════════════════════════════════════════════════════════════════════

  // ── ADDITIONAL KNOWN WORKDAY CAREER SITE SLUGS ────────────────────────────
  'abbviecareers','acaborecareers','adikioncareers','aikioncareers',
  'ameritas','amfam','ansys','ansyscareers',
  'aramark','aramarkcareers','arconic',
  'arrowelectronics','arrow','avanadecareer','avanade',
  'ball','ballcorp','bankofny','bnymellon',
  'beckmancoulter','belk',
  'bestbuy','bestbuycareers',
  'blackandveatch','bv',
  'brinker','brinks','brinkscareers',
  'broadridge','broadridgecareers',
  'brunswick','brunswickcareers',
  'burlington','burlingtoncoat',
  'cargill','cargillcareers',
  'celanese','celestica',
  'centerpointEnergy','centurylink',
  'cerner','oracle-cerner',
  'charlesriver','crl',
  'cintas','cintascareers',
  'citizens','citizensbank',
  'clorox','cloroxcareers',
  'cmc','cmcmarkets',
  'columbussurgical','conagra','conagrabrands',
  'corning','corningcareers',
  'corteva','cortevaAgriscience',
  'crowncastle','crowncastlecareers',
  'dana','danainc',
  'darden','dardenrestaurants',
  'davita','davitacareers',
  'dentsply','dentsplysirona',
  'discoverycareers','wbd',
  'dollargeneral','dollartree',
  'donaldson','dover','dovercorporation',
  'drhorton','drhortoncareers',
  'eastman','eastmanchemical',
  'edwardjones','edwardjonescareers',
  'emcor','emcorgroup',
  'entegris','entegriscareers',
  'equitable','equitablefinancial',
  'evergy','evergyinc',
  'expeditors','expeditorsinternational',
  'fastenal','fastenalcareers',
  'flowserve','flowservecareers',
  'fnf','fidelitynational',
  'foot-locker','footlocker',
  'fortive','fortivecareers',
  'foxcorporation','fox',
  'franklin-templeton','franklintempleton',
  'freeport','freeportmcmoran',
  'gartnerit',
  'gatx','gatxcareers',
  'genuineparts','gpc',
  'globalfoundries','gf',
  'goodyear','goodyearcareers',
  'grainger','wgrainger',
  'hanes','hanesbrands',
  'harley','harleydavidson',
  'hasbro','hasbrocareers',
  'hca','hcahealthcare',
  'henry-schein','henryschein',
  'hershey','hersheycareers',
  'hologic','hologiccareers',
  'hubbell','hubbellcareers',
  'huntington','huntingtonbank',
  'idex','idexcorporation',
  'incyte','incytecareers',
  'insperity','insperitycareers',
  'interpublic','ipg',
  'irobotcareers','irobot',
  'iron-mountain','ironmountain',
  'jack-henry','jackhenry',
  'jabil','jabilcareers',
  'jefferies','jefferiescareers',
  'jones-lang','joneslanglasalle',
  'juniper-networks','junipernetworkscareers',
  'kbhome','kbhomecareers',
  'keycorp','keybank',
  'kimberly-clark','kimberlyclark',
  'kforce','kforcecareers',
  'labcorp','labcorpcareers',
  'lamb-weston','lambweston',
  'landolakes','lando-lakes',
  'lazard','lazardcareers',
  'lennox','lennoxinternational',
  'levistrauss','levis',
  'lexmark','lexmarkcareers',
  'lithia','lithiamotors',
  'lkq','lkqcareers',
  'loews','loewscareers',
  'masco','mascocareers',
  'mattel','mattelcareers',
  'maximus','maximuscareers',
  'meritage','meritagehomes',
  'mettlertoledo','mettler',
  'mgm','mgmresorts',
  'mohawk','mohawkindustries',
  'molson','molsoncoors',
  'monolithic','monolithicpower',
  'moodys','moodysinvestors',
  'msci','mscicareers',
  'murphy-oil','murphyoil',
  'navistar','navistarcareers',
  'newscorp','newscorporation',
  'nordstrom','nordstromcareers',
  'norfolk-southern','norfolksouthern',
  'nucor','nucorcareers',
  'nvent','nventcareers',
  'oath','verizonmedia',
  'omnicom','omnicomgroup',
  'oneok','oneokcareers',
  'oshkosh','oshkoshcorporation',
  'owens-corning','owenscorning',
  'paccar','paccarcareers',
  'packaging-corp','pca',
  'paramount-global',
  'parker','parkerhannifin',
  'paychex','paychexcareers',
  'peak6','peak6investments',
  'pentair','pentaircareers',
  'peoples-united','peoplesbank',
  'petsmart','petsmartcareers',
  'piper-sandler','pipersandler',
  'pitneybowes','pitney',
  'pool-corp','poolcorporation',
  'ppg','ppgindustries',
  'principal','principalfinancial',
  'prologiscareers',
  'prudentialplc',
  'publicstorage',
  'pulte','pultegroup',
  'quanta','quantaservices',
  'quest','questdiagnostics',
  'raymond-james','raymondjames',
  'realogy','anywhereRE',
  'regions','regionsbank',
  'republic-services','republicservices',
  'resmed','resmedcareers',
  'roper','ropertechnologies',
  'ross','rossstores',
  'rpm','rpminternational',
  'sba','sbacommunications',
  'scotts','scottsmiraclecareers',
  'sealed-air','sealedair',
  'sempra','sempraenergy',
  'sherwin-williams','sherwinwilliams',
  'snap','snapinc','snapchat',
  'snap-on','snapon',
  'sonoco','sonocoProducts',
  'southwest-gas','southwestgas',
  'spectrum','spectrumbrands',
  'spglobal','sp-global',
  'sprouts','sproutsfarmers',
  'ss-c','ssctechnologies',
  'stanley','stanleyblackdecker',
  'steelcase','steelcasecareers',
  'stericycle','stericyclecareers',
  'stifel','stifelfinancial',
  'sunpower','sunpowercareers',
  'synaptics','synapticscareers',
  'sysco','syscocareers',
  'targa','targaresources',
  'taylor-morrison','taylormorrison',
  'td','tdbank','td-bank',
  'tegna','tegnacareers',
  'teradata','teradatacareers',
  'tjx','tjxcareers',
  'toro','torocompany',
  'tractor-supply','tractorsupply',
  'transdigm','transdigmgroup',
  'treehouse','treehousefoods',
  'trimble','trimblecareers',
  'tyson','tysonfoods',
  'under-armour','underarmourcareers',
  'universal-health','uhs',
  'usfoods','usfoodscareers',
  'valmont','valmontcareers',
  'verint','verintcareers',
  'verisk','veriskcareers',
  'viasat','viasatcareers',
  'vornado','vornadorealty',
  'vulcan','vulcanmaterials',
  'waste-management','wm',
  'watts-water','wattswater',
  'west-pharmaceutical','westpharma',
  'westrock','westrockcareers',
  'whirlpool','whirlpoolcareers',
  'williams-sonoma','wsi',
  'woodward','woodwardcareers',
  'xylem','xylemcareers',
  'zebra','zebratechnologies',
  'zimmer','zimmerbiomet-careers',
  'zoetis','zoetiscareers',

  // ── ADDITIONAL EUROPEAN ───────────────────────────────────────────────────
  'adecco','adeccocareers',
  'aegon','aegoncareers',
  'akzonobel','akzo',
  'arcelormittal','arcelormittalcareers',
  'asmpt','asm-international',
  'belgacom','proximus',
  'burberry','burberrycareers',
  'capgeminicareer',
  'compass-group','compassgroup',
  'dassault','dassaultsystemes',
  'dsv','dsvcareers',
  'electrolux','electroluxcareers',
  'experian','experiancareers',
  'ferrero','ferrerocareers',
  'gemalto','thalesgroup',
  'glencore','glencorecareers',
  'holcim','holcimcareers',
  'informa','informacareers',
  'isp','intesasanpaolo',
  'kone','konecareers',
  'kuehne-nagel','kuehnenagel',
  'legrand','legrandcareers',
  'luxottica','essilorluxottica',
  'maerskcareer',
  'michelin','michelincareers',
  'pandora','pandoracareers',
  'pernod-ricard','pernodricard',
  'repsol','repsolcareers',
  'saab','saabcareers',
  'sgs','sgscareers',
  'skf','skfcareers',
  'sodexo','sodexocareers',
  'stora-enso','storaenso',
  'tetra-pak','tetrapak',
  'upm','upmcareers',
  'wartsila','wartsilacareers',
  'wirecard',
  'wolseley','ferguson',
  'yara','yaracareers',
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

// ─────────────────────────────────────────────────────────────────────────────
// Workday API tester
// ─────────────────────────────────────────────────────────────────────────────

async function tryEndpoint(slug, instance, site) {
  const url = `https://${slug}.${instance}.myworkdayjobs.com/wday/cxs/${slug}/${site}/jobs`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: '' }),
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.total === 'undefined') return null;

    const jobs = data.jobPostings || [];
    const indiaJobs = jobs.filter(j => hasIndia(j.locationsText));

    // Check facets for India location count (often more accurate than page 1)
    let facetIndia = 0;
    if (data.facets) {
      const locGroup = data.facets.find(f => f.facetParameter === 'locationMainGroup');
      if (locGroup?.values?.[0]?.values) {
        for (const loc of locGroup.values[0].values) {
          if (hasIndia(loc.descriptor)) facetIndia += loc.count || 0;
        }
      }
    }

    return {
      slug, instance, site,
      total: data.total || 0,
      india: Math.max(indiaJobs.length, facetIndia),
      indiaJobs,
      url: `https://${slug}.${instance}.myworkdayjobs.com/${site}`,
      api: url,
    };
  } catch { clearTimeout(tid); return null; }
}

async function testWorkday(slug) {
  for (const [instance, site] of FAST_COMBOS) {
    const r = await tryEndpoint(slug, instance, site);
    if (r !== null) return r;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const uniqueSlugs = [...new Set(companySlugs)];
  const startTime = Date.now();

  console.log(`\n🔍 WORKDAY DISCOVERY — Testing ${uniqueSlugs.length} slugs`);
  console.log(`   ${FAST_COMBOS.length} instance×site combos per slug | Concurrency: ${CONCURRENCY}\n`);

  const found = [];
  const india = [];
  let tested = 0;

  for (let i = 0; i < uniqueSlugs.length; i += CONCURRENCY) {
    const batch = uniqueSlugs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(testWorkday));

    for (const r of results) {
      if (r) {
        found.push(r);
        if (r.india > 0) {
          india.push(r);
          console.log(`  ✅ ${r.slug} (${r.instance}/${r.site}): ${r.india} India / ${r.total} total`);
        }
      }
    }

    tested = Math.min(i + CONCURRENCY, uniqueSlugs.length);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(
      `\r  [${tested}/${uniqueSlugs.length}] ${elapsed}s | Workday: ${found.length} | 🇮🇳 India: ${india.length}   `
    );

    if (i + CONCURRENCY < uniqueSlugs.length) await sleep(BATCH_DELAY_MS);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // ══════════════════════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`📊 WORKDAY DISCOVERY RESULTS (${totalTime}s)`);
  console.log(`   ${uniqueSlugs.length} slugs tested | ${found.length} Workday boards | ${india.length} with India jobs`);
  console.log(`${'═'.repeat(80)}`);

  // ── ALL FOUND ─────────────────────────────────────────────────────────────
  if (found.length > 0) {
    console.log(`\n📋 ALL WORKDAY BOARDS FOUND (${found.length}):`);
    console.log(`${'─'.repeat(80)}`);
    const sorted = [...found].sort((a, b) => b.total - a.total);
    for (const r of sorted) {
      const flag = r.india > 0 ? `🇮🇳 ${String(r.india).padStart(4)}` : `      0`;
      const pad = ' '.repeat(Math.max(1, 30 - r.slug.length));
      console.log(`  ${r.slug}${pad}${r.instance}/${r.site.padEnd(20)} ${flag} India / ${r.total} total`);
    }
  }

  // ── INDIA ONLY ────────────────────────────────────────────────────────────
  if (india.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🇮🇳 BOARDS WITH INDIA JOBS (${india.length}):`);
    console.log(`${'─'.repeat(80)}`);
    const sortedIndia = [...india].sort((a, b) => b.india - a.india);
    for (const r of sortedIndia) {
      const pad = ' '.repeat(Math.max(1, 30 - r.slug.length));
      console.log(`  ${r.slug}${pad}${r.instance}/${r.site.padEnd(20)} 🇮🇳 ${r.india} India / ${r.total} total`);
    }

    // ── COPY-PASTE CONFIG ─────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 PASTE INTO workdayConfig.js — companyBoards:`);
    console.log(`${'═'.repeat(80)}\n`);
    console.log(`const companyBoards = [`);
    for (const r of sortedIndia) {
      const cPad = ' '.repeat(Math.max(1, 26 - r.slug.length));
      const sPad = ' '.repeat(Math.max(1, 22 - r.site.length));
      console.log(`  { company: '${r.slug}',${cPad}instance: '${r.instance}', site: '${r.site}',${sPad}name: '${r.slug}' },  // ${r.india} India / ${r.total} total`);
    }
    console.log(`];\n`);
  }

  // ── ALL FOUND CONFIG ──────────────────────────────────────────────────────
  if (found.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 ALL FOUND — Full config (including non-India):`);
    console.log(`${'═'.repeat(80)}\n`);
    console.log(`const allWorkdayBoards = [`);
    const sortedAll = [...found].sort((a, b) => b.total - a.total);
    for (const r of sortedAll) {
      const cPad = ' '.repeat(Math.max(1, 26 - r.slug.length));
      const sPad = ' '.repeat(Math.max(1, 22 - r.site.length));
      console.log(`  { company: '${r.slug}',${cPad}instance: '${r.instance}', site: '${r.site}',${sPad}name: '${r.slug}' },  // ${r.india} India / ${r.total} total`);
    }
    console.log(`];\n`);
  }

  // ── SAMPLE INDIA JOBS ─────────────────────────────────────────────────────
  if (india.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🔍 SAMPLE INDIA JOBS (top 20 companies, 3 jobs each):`);
    console.log(`${'═'.repeat(80)}`);
    for (const r of [...india].sort((a, b) => b.india - a.india).slice(0, 20)) {
      console.log(`\n  📌 ${r.slug} (${r.instance}/${r.site}) — ${r.india} India jobs:`);
      for (const j of r.indiaJobs.slice(0, 3)) {
        console.log(`     • ${j.title}`);
        console.log(`       ${j.locationsText} | ${j.postedOn || ''}`);
      }
    }
  }

  console.log('');
}

main();