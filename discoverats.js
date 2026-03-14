#!/usr/bin/env node

/**
 * ATS Discovery Tool — Greenhouse, Ashby, Lever
 * Tests 1500+ company slugs against all 3 free public APIs.
 * Usage: node src/discoverats.js
 */

const CONCURRENCY = 8;
const BATCH_DELAY_MS = 2000;
const TIMEOUT_MS = 10000;

const companySlugs = [
  // ═══════════════════════════════════════════════════════════════
  // INDIAN UNICORNS & DECACORNS (70+)
  // ═══════════════════════════════════════════════════════════════
  'razorpay','razorpay-software','razorpaysoftware',
  'cred','cred-club','credclub',
  'meesho','meesho-tech','meeshotech',
  'groww','groww-in','growwin',
  'zerodha','zerodha-tech',
  'phonepe','phonepe-tech','phonepetech',
  'swiggy','swiggy-tech','swiggytech',
  'zomato','zomato-tech','zomatotech',
  'flipkart','flipkart-tech','flipkarttech',
  'paytm','paytm-tech','one97','paytmtech',
  'ola','ola-cabs','olacabs','ola-electric','olaelectric',
  'byjus','byjus-tech','think-and-learn','thinkandlearn',
  'oyo','oyo-rooms','oyorooms','oyo-tech',
  'dream11','dream-sports','dreamsports',
  'delhivery','delhivery-tech','delhiverytech',
  'nykaa','nykaa-tech','fsn-ecommerce','nykaatech',
  'udaan','udaan-tech','udaantech',
  'bharatpe','bharatpe-tech','bharatpetech',
  'slice','slice-tech','slice-fintech','slicefintech',
  'jupiter','jupiter-money','jupitermoney',
  'fi','fi-money','epifi','fimoney',
  'curefit','cure-fit','cultfit','cult-fit',
  'lenskart','lenskart-tech','lenskarttech',
  'boat','boatlifestyle','boat-lifestyle','imagine-marketing',
  'urban-company','urbancompany','urbanclap','urban-clap',
  'unacademy','unacademy-tech','unacademytech',
  'vedantu','vedantu-tech','vedantutech',
  'physicswallah','physics-wallah','pw','pw-tech',
  'upgrad','upgrad-tech','upgradtech',
  'zepto','zepto-tech','zeptotech',
  'blinkit','blinkit-tech','blinkitech',
  'dunzo','dunzo-tech','dunzotech',
  'rapido','rapido-bike','rapidobike',
  'myntra','myntra-tech','myntratech',
  'makemytrip','make-my-trip','mmt',
  'ixigo','ixigo-tech',
  'cleartrip','cleartrip-tech',
  'cars24','cars-24',
  'spinny','spinny-tech',
  'acko','acko-tech','acko-insurance',
  'nobroker','nobroker-tech',
  'housing','housing-com','housingcom',
  'magicbricks','magic-bricks',
  'practo','practo-tech',
  'pharmeasy','pharm-easy','pharmeasytech',
  '1mg','tata-1mg','tata1mg',
  'apna','apna-tech','apnatech',
  'sharechat','share-chat','verse-innovation','verseinnovation',
  'dailyhunt','daily-hunt',
  'licious','licious-tech',
  'bigbasket','big-basket',
  'country-delight','countrydelight',
  'ninjacart','ninja-cart',
  'dealshare','deal-share',
  'khatabook','khata-book',
  'mobikwik','mobi-kwik',
  'policybazaar','policy-bazaar','pb-fintech','pbfintech',
  'pepperfry','pepper-fry',
  'snapdeal','snap-deal',
  'firstcry','first-cry',
  'mamaearth','mama-earth','honasa',
  'bewakoof','bewakoof-brands',
  'wakefit','wake-fit',
  'purplle','purplle-tech',
  'mpl','mobile-premier-league',
  'winzo','winzo-games',

  // ═══════════════════════════════════════════════════════════════
  // INDIAN SAAS / TECH PRODUCT (150+)
  // ═══════════════════════════════════════════════════════════════
  'freshworks','freshworks-inc','freshdesk','freshsales','freshservice',
  'zoho','zoho-corp','zoho-corporation','zohocorp',
  'chargebee','chargebee-inc','chargebeetech',
  'postman','postman-tech','postmantech',
  'hasura','hasura-tech','hasuratech',
  'browserstack','browser-stack','browserstacktech',
  'lambdatest','lambda-test',
  'clevertap','clever-tap','clevertaptech',
  'moengage','mo-engage','moengagetech',
  'webengage','web-engage',
  'leadsquared','lead-squared','leadsquaredtech',
  'darwinbox','darwin-box','darwinboxtech',
  'keka','keka-hr','kekahr',
  'greythr','grey-thr','greytip','greythrtech',
  'haptik','haptik-tech','haptiktech',
  'yellowai','yellow-ai','yellow-messenger','yellowmessenger',
  'gupshup','gup-shup','gupshuptech',
  'verloop','verloop-io','verlooptech',
  'whatfix','what-fix','whatfixtech',
  'mindtickle','mind-tickle','mindtickletech',
  'icertis','icertis-tech','icertistech',
  'druva','druva-tech','druvatech',
  'netcore','netcore-cloud','netcorecloud',
  'exotel','exotel-tech','exoteltech',
  'sprinklr','sprinklr-tech','sprinklrtech',
  'capillary','capillary-technologies','capillarytech',
  'kissflow','kiss-flow','kissflowtech',
  'rocketlane','rocket-lane','rocketlanetech',
  'hevodata','hevo-data','hevo',
  'sigmoid','sigmoid-analytics','sigmoidanalytics',
  'tredence','tredence-analytics',
  'fractal','fractal-analytics','fractal-ai','fractalanalytics',
  'musigma','mu-sigma',
  'latentview','latent-view','latent-view-analytics',
  'tigeranalytics','tiger-analytics',
  'inmobi','in-mobi','inmobitech',
  'medianet','media-net',
  'glance','glance-tech','glance-inmobi',
  'smallcase','small-case','smallcasetech',
  'kuvera','kuvera-tech',
  'upstox','upstox-tech','upstoxtech',
  'angelone','angel-one','angel-broking',
  'juspay','juspay-tech','juspaytech',
  'setu','setu-tech','setutech',
  'decentro','decentro-tech',
  'cashfree','cashfree-payments','cashfreepayments',
  'instamojo','insta-mojo',
  'signzy','signzy-tech',
  'perfios','perfios-tech',
  'hyperverge','hyper-verge',
  'simpl','simpl-tech','getsimpl',
  'niyo','niyo-solutions','goniyo',
  'zeta','zeta-tech','zetasuit',
  'recko','recko-tech',
  'fyle','fyle-tech','fylehq',
  'servify','servify-tech',
  'classplus','class-plus',
  'teachmint','teach-mint',
  'doubtnut','doubt-nut',
  'toppr','toppr-tech',
  'embibe','embibe-tech',
  'testbook','test-book',
  'scaler','scaler-academy','scaleracademy','interviewbit','interview-bit',
  'codingninjas','coding-ninjas',
  'masai','masai-school','masaischool',
  'newton-school','newtonschool',
  'pesto','pesto-tech','pestotech',
  'almabetter','alma-better',
  'crio','crio-do','criodo',
  'nxtwave','nxt-wave',
  'unstop','unstop-tech','dare2compete',
  'devfolio','dev-folio',
  'workindia','work-india',
  'apnaklub','apna-klub',
  'revature','revature-india',
  'commvault','commvault-india',
  'nutanix','nutanix-india',
  'cohesity','cohesity-india',
  'rubrik','rubrik-india',
  'paloaltonetworks','palo-alto-networks',
  'crowdstrike','crowd-strike',
  'zscaler','z-scaler',
  'okta','okta-india',
  'sailpoint','sail-point',
  'cyberark','cyber-ark',
  'forcepoint','force-point',
  'sophos','sophos-india',
  'trellix','trellix-india',

  // ═══════════════════════════════════════════════════════════════
  // INDIAN IT SERVICES / CONSULTING MID-CAP (100+)
  // ═══════════════════════════════════════════════════════════════
  'thoughtworks','thought-works','thoughtworks-india',
  'hashedin','hashedin-tech','hashedintech',
  'nagarro','nagarro-tech','nagarrotech',
  'epam','epam-india','epam-systems',
  'publicissapient','publicis-sapient','sapient',
  'xoriant','xoriant-tech',
  'talentica','talentica-software',
  'mphasis','mphasis-tech',
  'ltimindtree','lti-mindtree','lti','mindtree',
  'coforge','coforge-tech',
  'zensar','zensar-tech','zensartech',
  'persistent','persistent-systems','persistentsystems',
  'birlasoft','birla-soft',
  'sonata-software','sonatasoftware',
  'cyient','cyient-tech','cyienttech',
  'happiest-minds','happiestminds',
  'mastek','mastek-tech',
  'newgen','newgen-software','newgensoftware',
  'cigniti','cigniti-tech',
  'indium','indium-software','indiumsoftware',
  'kellton','kellton-tech',
  'datamatics','datamatics-tech',
  'techwave','tech-wave',
  'prodapt','prodapt-solutions',
  'subex','subex-tech',
  'sasken','sasken-tech',
  'mobileware','mobile-ware',
  'valuelab','value-lab',
  'aurigo','aurigo-software',
  'saksoft','sak-soft',
  'intellect-design','intellectdesign',
  'nucleus-software','nucleussoftware',
  'ramco','ramco-systems',
  'qualitest','quali-test',
  'globallogic','global-logic',
  'amdocs','amdocs-india',
  'synopsys','synopsys-india',
  'cadence','cadence-design',
  'altran','altran-india',
  'capgemini','capgemini-india',
  'accenture','accenture-india',
  'cognizant','cognizant-india',
  'infosys','infosys-tech',
  'wipro','wipro-tech',
  'tcs','tata-consultancy',
  'hcl','hcltech','hcl-technologies',
  'techm','tech-mahindra','techmahindra',

  // ═══════════════════════════════════════════════════════════════
  // FINTECH / PAYMENTS / BANKING TECH (80+)
  // ═══════════════════════════════════════════════════════════════
  'payu','pay-u','payu-india',
  'pinelabs','pine-labs',
  'innoviti','innoviti-payment',
  'fiserv','fiserv-india',
  'finastra','finastra-india',
  'temenos','temenos-india',
  'edgeverve','edge-verve',
  'rupeek','rupeek-fintech',
  'lendingkart','lending-kart',
  'navi','navi-tech','navi-finserv',
  'moneycontrol','money-control',
  'tickertape','ticker-tape',
  'paytmmoney','paytm-money',
  'mswipe','m-swipe',
  'ezetap','eze-tap',
  'worldline','worldline-india',
  'razorpayx','razorpay-x',
  'open-financial','open-money','bankopen',
  'indifi','indifi-tech',
  'tartanhq','tartan-hq','tartan',
  'revfin','rev-fin',
  'credavenue','cred-avenue',
  'northernarc','northern-arc',
  'vivriti','vivriti-capital',
  'finbox','fin-box',
  'yubi','yubi-tech',
  'zaggle','zaggle-tech',
  'moneytap','money-tap',
  'jupiter-tech','jupitertech',
  'stashfin','stash-fin',
  'kreditbee','kredit-bee',
  'moneyview','money-view',
  'truebalance','true-balance',
  'zestmoney','zest-money',
  'kissht','kiss-ht',
  'earlysalary','early-salary',
  'flexmoney','flex-money',
  'lazypay','lazy-pay',
  'simpl-pay','simplpay',
  'slice-pay','slicepay',
  'uni-cards','unicards',
  'onecard','one-card',
  'cred-pay','credpay',
  'freecharge','free-charge',
  'amazonpay','amazon-pay',
  'googlepay','google-pay',
  'airtel-payments','airtelpayments',
  'jio-payments','jiopayments',

  // ═══════════════════════════════════════════════════════════════
  // HEALTHTECH / BIOTECH (50+)
  // ═══════════════════════════════════════════════════════════════
  'mfine','m-fine',
  'pristyncare','pristyn-care',
  'healthifyme','healthify-me',
  'dozee','dozee-tech',
  'niramai','niramai-tech',
  'qureai','qure-ai',
  'sigtuple','sig-tuple',
  'tricog','tricog-health',
  'innovaccer','innovaccer-health',
  'ekincare','eki-care',
  'netmeds','net-meds',
  'medlife','med-life',
  'apollo247','apollo-247',
  'tatahealth','tata-health',
  'amaha','amaha-health',
  'wysa','wysa-health',
  'breathe-well','breathewell',
  'healthians','healthians-tech',
  'thyrocare','thyro-care',
  'docplexus','doc-plexus',
  'curelink','cure-link',
  'mojocare','mojo-care',
  'zyla','zyla-health',
  'meddo','meddo-health',
  'navia','navia-life',
  'predible','predible-health',
  'siemens-healthineers','siemenshealthineers',
  'ge-healthcare','gehealthcare',
  'philips-healthcare','philipshealthcare',
  'baxter','baxter-india',

  // ═══════════════════════════════════════════════════════════════
  // D2C / ECOMMERCE / RETAIL (80+)
  // ═══════════════════════════════════════════════════════════════
  'ajio','ajio-tech',
  'tata-cliq','tatacliq',
  'urbanladder','urban-ladder',
  'fabindia','fab-india',
  'zivame','zivame-tech',
  'sugarcosmetics','sugar-cosmetics',
  'plum','plum-goodness',
  'boult','boult-audio',
  'noise','noise-tech','gonoise',
  'fireboltt','fire-boltt',
  'bluestone','blue-stone',
  'caratlane','carat-lane',
  'melorra','melorra-tech',
  'yatra','yatra-online',
  'goibibo','goibibo-tech',
  'treebo','treebo-hotels',
  'fabhotels','fab-hotels',
  'zostel','zostel-tech',
  'meesho-supply','meesho-marketplace',
  'nykaa-fashion','nykaafashion',
  'titan','titan-company',
  'tanishq','tanishq-tech',
  'clovia','clovia-tech',
  'wow-skin','wowskinscience',
  'portronics','portronics-tech',
  'ptron','ptron-tech',
  'zebronics','zebronics-tech',
  'realme','realme-india',
  'xiaomi','xiaomi-india','mi-india',
  'oneplus','oneplus-india',
  'oppo','oppo-india',
  'vivo','vivo-india',
  'samsung-india','samsungindia',
  'tata-digital','tatadigital',
  'jiomart','jio-mart',
  'reliance-retail','relianceretail',
  'dmartready','dmart-ready',
  'grofers','grofers-tech',
  'milkbasket','milk-basket',
  'supr-daily','suprdaily',
  'bb-now','bbnow','bbdaily',
  'swiggy-instamart','swiggyinstamart',
  'zomato-hyperpure','zomatohyperpure',
  'udaan-business','udaanbusiness',
  'jumbotail','jumbo-tail',
  'shopkirana','shop-kirana',

  // ═══════════════════════════════════════════════════════════════
  // LOGISTICS / SUPPLY CHAIN / MOBILITY (60+)
  // ═══════════════════════════════════════════════════════════════
  'shiprocket','ship-rocket',
  'ecomexpress','ecom-express',
  'shadowfax','shadow-fax',
  'loadshare','load-share',
  'rivigo','rivigo-tech',
  'blackbuck','black-buck',
  'porter','porter-tech',
  'vahak','vahak-tech',
  'cogoport','cogo-port',
  'locus','locus-sh',
  'fareye','far-eye',
  'loginext','log-i-next',
  'shipsy','shipsy-tech',
  'pickrr','pickrr-tech',
  'elasticrun','elastic-run',
  'magicpin','magic-pin',
  'parkplus','park-plus',
  'blowhorn','blow-horn',
  'freightwalla','freight-walla',
  'freightfox','freight-fox',
  'flyingbeast','flying-beast',
  'grab-india','grabindia',
  'uber-india','uberindia',
  'bounce','bounce-tech',
  'vogo','vogo-tech',
  'yulu','yulu-bikes',
  'drivezy','drivezy-tech',
  'zoomcar','zoom-car',
  'myles','myles-cars',
  'revv','revv-cars',
  'savaari','savaari-tech',
  'shuttl','shuttl-tech',
  'chalo','chalo-tech',
  'cityflo','city-flo',
  'nammayatri','namma-yatri',

  // ═══════════════════════════════════════════════════════════════
  // ENTERPRISE B2B SAAS (80+)
  // ═══════════════════════════════════════════════════════════════
  'zenoti','zenoti-tech',
  'o9solutions','o9-solutions',
  'amagi','amagi-media',
  'uniphore','uni-phore',
  'observeai','observe-ai',
  'karza','karza-tech',
  'axtria','axtria-tech',
  'mantra-labs','mantralabs',
  'highradius','high-radius',
  'thoughtspot','thoughtspot-india',
  'wingify','wingify-tech','vwo',
  'hackerrank','hacker-rank',
  'hackerearth','hacker-earth',
  'directi','direct-i',
  'radixweb','radix-web',
  'simform','sim-form',
  'einfochips','einfo-chips',
  'crest-data','crestdata',
  'tatvasoft','tatva-soft',
  'azilen','azilen-tech',
  'rapidops','rapid-ops',
  'argusoft','argu-soft',
  'tudip','tudip-tech',
  'inexture','inexture-tech',
  'softobiz','softo-biz',
  'appinventiv','app-inventiv',
  'hyperlink','hyperlink-infosystem',
  'konstant','konstant-infosolutions',
  'techugo','tec-hugo',
  'mindinventory','mind-inventory',
  'openxcell','open-xcell',
  'bacancy','bacancy-tech',
  'maruti-techlabs','marutitechlabs',
  'cuelogic','cue-logic',
  'velotio','velotio-tech',
  'synerzip','synerzip-tech',
  'clarice','clarice-tech',
  'harbinger','harbinger-group',
  'quantiphi','quanti-phi',
  'aiml','ai-ml',
  'sigmoid-tech','sigmoidtech',
  'tredence-tech','tredencetech',
  'gramener','gramener-tech',
  'dataweave','data-weave',
  'crayon-data','crayondata',
  'flutura','flutura-tech',
  'bridgei2i','bridge-i2i',
  'manthan','manthan-tech',
  'absolutdata','absolut-data',
  'algonomy','algonomy-tech',

  // ═══════════════════════════════════════════════════════════════
  // AI / DEEPTECH / SPACETECH (60+)
  // ═══════════════════════════════════════════════════════════════
  'sarvam','sarvam-ai','sarvamai',
  'krutrim','krutrim-ai',
  'wadhwani-ai','wadhwaniai',
  'agnikul','agnikul-cosmos',
  'skyroot','skyroot-aerospace',
  'pixxel','pixxel-space',
  'bellatrix','bellatrix-aerospace',
  'dhruvaspace','dhruva-space',
  'vernacularai','vernacular-ai',
  'gnaniai','gnani-ai',
  'aryaai','arya-ai',
  'fluidai','fluid-ai',
  'entropik','entropik-tech',
  'e42','e42-ai',
  'nikiai','niki-ai',
  'mygate','my-gate',
  'apartmentadda','apartment-adda',
  'proptiger','prop-tiger',
  'quikr','quikr-tech',
  '99acres','99-acres',
  'olx','olx-india',
  'cropin','crop-in',
  'agrostar','agro-star',
  'bijak','bijak-tech',
  'waycool','way-cool',
  'stellapps','stell-apps',
  'ather','ather-energy','atherenergy',
  'revolt','revolt-motors',
  'ultraviolette','ultra-violette',
  'tork','tork-motors',
  'simpleenergy','simple-energy',
  'log9','log9-materials',
  'exponentenergy','exponent-energy',
  'ionenergy','ion-energy',
  'lohum','lohum-cleantech',
  'grinntech','grinn-tech',
  'zunroof','zun-roof',
  'fourth-partner','fourthpartner',
  'hero-electric','heroelectric',
  'ampere','ampere-vehicles',

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL TECH — BIG WITH INDIA OFFICES (200+)
  // ═══════════════════════════════════════════════════════════════
  'stripe','stripe-tech',
  'notion','notion-hq','notion-tech',
  'vercel','vercel-tech',
  'supabase','supabase-tech',
  'linear','linear-app',
  'figma','figma-tech',
  'canva','canva-tech',
  'gitlab','git-lab',
  'datadog','data-dog',
  'snyk','snyk-tech',
  'elastic','elastic-tech',
  'cloudflare','cloud-flare',
  'hashicorp','hashi-corp',
  'confluent','confluent-tech',
  'cockroachlabs','cockroach-labs',
  'timescale','timescale-db',
  'airbyte','airbyte-tech',
  'dbt-labs','dbt',
  'fivetran','five-tran',
  'amplitude','amplitude-tech',
  'mixpanel','mix-panel',
  'segment','segment-tech','twilio-segment',
  'contentful','content-ful',
  'twilio','twilio-tech',
  'hubspot','hub-spot',
  'intercom','inter-com',
  'zendesk','zen-desk',
  'atlassian','atlassian-tech',
  'asana','asana-tech',
  'monday','monday-com',
  'clickup','click-up',
  'airtable','air-table',
  'retool','re-tool',
  'deel','deel-tech',
  'remote','remote-com',
  'rippling','rippling-tech',
  'personio','personio-tech',
  'miro','miro-tech',
  'grammarly','grammarly-tech',
  'gojek','go-jek',
  'grab','grab-tech',
  'shopify','shopify-tech',
  'wix','wix-tech',
  'webflow','web-flow',
  'netlify','netlify-tech',
  'databricks','data-bricks',
  'snowflake','snowflake-tech',
  'mongodb','mongo-db',
  'redis','redis-labs',
  'neo4j','neo-4j',
  'algolia','algolia-tech',
  'appwrite','app-write',
  'strapi','strapi-tech',
  'sanity','sanity-io',
  'prisma','prisma-tech',
  'cohere','cohere-tech',
  'stabilityai','stability-ai',
  'huggingface','hugging-face',
  'langchain','lang-chain',
  'pinecone','pine-cone',
  'weaviate','weaviate-tech',
  'airbnb',
  'pinterest',
  'reddit',
  'twitch',
  'discord',
  'spotify',
  'slack',
  'dropbox',
  'docusign',
  'pagerduty',
  'newrelic','new-relic',
  'sentry','sentry-io',
  'launchdarkly','launch-darkly',
  'planetscale','planet-scale',
  'neon','neon-tech',
  'turso','turso-tech',
  'convex','convex-tech',
  'clerk','clerk-dev',
  'resend','resend-tech',
  'plaid','plaid-tech',
  'brex','brex-tech',
  'ramp','ramp-tech',
  'mercury','mercury-tech',
  'gusto','gusto-tech',
  'loom','loom-tech',
  'pitch','pitch-tech',
  'jasper','jasper-ai',
  'writesonic','write-sonic',
  'copy-ai','copyai',

  // ── More Global Tech with India offices ──
  'salesforce','salesforce-india',
  'oracle','oracle-india',
  'microsoft','microsoft-india',
  'google','google-india',
  'amazon','amazon-india',
  'meta','meta-india','facebook',
  'apple','apple-india',
  'adobe','adobe-india',
  'vmware','vmware-india',
  'dell','dell-india',
  'ibm','ibm-india',
  'sap','sap-india',
  'servicenow','service-now',
  'workday','workday-india',
  'splunk','splunk-india',
  'dynatrace','dynatrace-india',
  'appdynamics','app-dynamics',
  'newrelic','new-relic-india',
  'pagerduty','pager-duty',
  'gitlab','gitlab-india',
  'github','github-india',
  'jetbrains','jet-brains',
  'docker','docker-tech',
  'kubernetes','kubernetes-tech',
  'redhat','red-hat',
  'canonical','canonical-ubuntu',
  'suse','suse-tech',
  'elastic','elastic-india',
  'couchbase','couch-base',
  'yugabyte','yuga-byte',
  'cockroachdb','cockroach-db',
  'percona','percona-tech',
  'mariadb','maria-db',
  'singlestore','single-store',
  'starburst','star-burst',
  'dremio','dremio-tech',
  'cloudera','cloudera-tech',
  'teradata','tera-data',
  'informatica','informatica-india',
  'talend','talend-tech',
  'tableau','tableau-tech',
  'looker','looker-tech',
  'metabase','meta-base',
  'hex','hex-tech',
  'mode','mode-analytics',
  'observable','observable-tech',
  'paperspace','paper-space',
  'lambdalabs','lambda-labs',
  'replicate','replicate-tech',
  'modal','modal-tech',
  'anyscale','any-scale',
  'wandb','weights-and-biases',
  'roboflow','robo-flow',
  'labelbox','label-box',
  'scaleai','scale-ai',
  'appen','appen-tech',

  // ── Well-known Greenhouse/Lever/Ashby users ──
  'benchling','braze','calm','chime',
  'coinbase','coursera','cruise',
  'doordash','duolingo','faire','fastly',
  'flexport','instacart','lyft','marqeta',
  'nerdwallet','nuro','onemedical','one-medical',
  'opensea','outreach','palantir','pilot',
  'quora','relativity','robinhood','scale',
  'samsara','sofi','square','squarespace',
  'thumbtack','toast','tripactions','vanta',
  'verkada','wealthfront',
  'rivian','lucid','tesla',
  'nvidia','amd','intel','qualcomm',
  'broadcom','marvell','micron',
  'applied-materials','appliedmaterials',
  'lam-research','lamresearch',
  'asml','asml-tech',
  'texas-instruments','texasinstruments',
  'analog-devices','analogdevices',
  'maxim','maxim-integrated',
  'microchip','microchip-tech',
  'nxp','nxp-semi',
  'infineon','infineon-tech',
  'stmicro','stmicroelectronics',
  'renesas','renesas-tech',
  'mediatek','media-tek',
  'arm','arm-tech',
  'cadence','cadence-design-systems',
  'synopsys','synopsys-tech',
  'ansys','ansys-tech',
  'mathworks','math-works',
  'autodesk','auto-desk',
  'ptc','ptc-tech',
  'siemens-digital','siemensdigital',
  'dassault','dassault-systemes',
  'honeywell','honeywell-india',
  'bosch','bosch-india',
  'schneider','schneider-electric',
  'abb','abb-india',
  'emerson','emerson-india',
  'rockwell','rockwell-automation',
  'ge','ge-india',
  'hitachi','hitachi-india',
  'mitsubishi','mitsubishi-india',
  'panasonic','panasonic-india',
  'sony','sony-india',
  'lg','lg-india',
  'philips','philips-india',

  // ═══════════════════════════════════════════════════════════════
  // EDTECH / GAMING / MEDIA (60+)
  // ═══════════════════════════════════════════════════════════════
  'byjus-think','whitehat','whitehat-jr','whitehatjr',
  'simplilearn','simpli-learn',
  'greatlearning','great-learning',
  'eruditus','eruditus-tech',
  'emeritus','emeritus-tech',
  'cuemath','cue-math',
  'extramarks','extra-marks',
  'gradeup','grade-up',
  'adda247','adda-247',
  'allen-digital','allendigital',
  'aakash','aakash-digital',
  'leverage-edu','leverageedu',
  'collegedunia','college-dunia',
  'shiksha','shiksha-tech',
  'careers360','careers-360',
  'naukri','naukri-tech',
  'infoedge','info-edge',
  'times-internet','timesinternet',
  'hungama','hungama-digital',
  'gaana','gaana-tech',
  'jiosavan','jio-saavn',
  'wynk','wynk-music',
  'viacom18','viacom-18',
  'zee5','zee-5','zee5-tech',
  'sonyliv','sony-liv',
  'hotstar','disney-hotstar',
  'erosnow','eros-now',
  'mxplayer','mx-player',
  'games24x7','games-24x7',
  'dream11-tech','dream11tech',
  'nazara','nazara-tech',
  'gameskraft','games-kraft',
  'hike','hike-tech',
  'koo-app','koo','kooapp',
  'josh','josh-app',
  'chingari','chingari-tech',
  'moj','moj-app',
  'roposo','roposo-tech',
  'trell','trell-tech',
  'pepper-content','peppercontent',
  'kuku-fm','kukufm',
  'pratilipi','prati-lipi',
  'pocket-fm','pocketfm',
  'stage-app','stageapp',
];

const indianCities = [
  'bangalore','bengaluru','mumbai','delhi','new delhi',
  'hyderabad','pune','chennai','noida','gurgaon','gurugram',
  'kolkata','ahmedabad','jaipur','lucknow','chandigarh',
  'indore','nagpur','coimbatore','kochi','cochin',
  'thiruvananthapuram','trivandrum','visakhapatnam','vizag',
  'bhubaneswar','mangalore','mysore','mysuru','vadodara',
  'surat','patna','ranchi','guwahati','bhopal',
];

function hasIndiaLocation(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (t.includes('india')) return true;
  return indianCities.some(c => t.includes(c));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timeout);
    return res;
  } catch (err) { clearTimeout(timeout); throw err; }
}

async function testGreenhouse(slug) {
  try {
    const res = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
    if (!res.ok) return null;
    const data = await res.json();
    const jobs = data.jobs || [];
    const india = jobs.filter(j => hasIndiaLocation(j.location?.name)).length;
    return { slug, platform: 'greenhouse', total: jobs.length, india };
  } catch { return null; }
}

async function testAshby(slug) {
  try {
    const res = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (!res.ok) return null;
    const data = await res.json();
    const jobs = data.jobs || [];
    const india = jobs.filter(j => hasIndiaLocation(j.location)).length;
    return { slug, platform: 'ashby', total: jobs.length, india };
  } catch { return null; }
}

async function testLever(slug) {
  try {
    const res = await fetchWithTimeout(`https://api.lever.co/v0/postings/${slug}`);
    if (!res.ok) return null;
    const jobs = await res.json();
    if (!Array.isArray(jobs)) return null;
    const india = jobs.filter(j => hasIndiaLocation(j.categories?.location)).length;
    return { slug, platform: 'lever', total: jobs.length, india };
  } catch { return null; }
}

async function testSlug(slug) {
  const [gh, ash, lev] = await Promise.all([testGreenhouse(slug), testAshby(slug), testLever(slug)]);
  return [gh, ash, lev].filter(Boolean);
}

async function main() {
  const uniqueSlugs = [...new Set(companySlugs)];
  const startTime = Date.now();
  console.log(`\n🔍 Testing ${uniqueSlugs.length} slugs × 3 platforms (${CONCURRENCY} parallel)\n`);

  const greenhouse = { found: [], india: [] };
  const ashby = { found: [], india: [] };
  const lever = { found: [], india: [] };
  const platformMap = { greenhouse, ashby, lever };

  for (let i = 0; i < uniqueSlugs.length; i += CONCURRENCY) {
    const batch = uniqueSlugs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(testSlug));
    for (const results of batchResults) {
      for (const r of results) {
        const p = platformMap[r.platform];
        p.found.push(r);
        if (r.india > 0) {
          p.india.push(r);
          console.log(`  ✅ [${r.platform.toUpperCase()}] ${r.slug}: ${r.india} India / ${r.total} total`);
        }
      }
    }
    const done = Math.min(i + CONCURRENCY, uniqueSlugs.length);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const totalIndia = greenhouse.india.length + ashby.india.length + lever.india.length;
    const totalFound = greenhouse.found.length + ashby.found.length + lever.found.length;
    process.stdout.write(`\r  [${done}/${uniqueSlugs.length}] ${elapsed}s | found: ${totalFound} | 🇮🇳 india: ${totalIndia}`);
    if (i + CONCURRENCY < uniqueSlugs.length) await sleep(BATCH_DELAY_MS);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log(`📊 RESULTS (${totalTime}s) — ${uniqueSlugs.length} slugs × 3 platforms`);
  console.log(`${'═'.repeat(70)}`);

  for (const [name, data] of Object.entries(platformMap)) {
    console.log(`\n  ${name.toUpperCase()}: ${data.found.length} companies, ${data.india.length} with India jobs`);
    if (data.india.length > 0) {
      console.log(`  ${'─'.repeat(50)}`);
      for (const r of data.india.sort((a, b) => b.india - a.india)) {
        console.log(`    ${r.slug}${' '.repeat(Math.max(1, 30 - r.slug.length))}${r.india} India / ${r.total} total`);
      }
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 COPY INTO YOUR CONFIG FILES:`);
  console.log(`${'═'.repeat(70)}`);

  if (greenhouse.india.length > 0) {
    console.log(`\n// greenhouseConfig.js — companyBoardTokens:`);
    for (const r of greenhouse.india.sort((a, b) => b.india - a.india)) {
      console.log(`  '${r.slug}',${' '.repeat(Math.max(1, 30 - r.slug.length))}// ${r.india} India jobs`);
    }
  }
  if (ashby.india.length > 0) {
    console.log(`\n// ashbyConfig.js — companySlugs:`);
    for (const r of ashby.india.sort((a, b) => b.india - a.india)) {
      console.log(`  '${r.slug}',${' '.repeat(Math.max(1, 30 - r.slug.length))}// ${r.india} India jobs`);
    }
  }
  if (lever.india.length > 0) {
    console.log(`\n// leverConfig.js — companySlugs:`);
    for (const r of lever.india.sort((a, b) => b.india - a.india)) {
      console.log(`  '${r.slug}',${' '.repeat(Math.max(1, 30 - r.slug.length))}// ${r.india} India jobs`);
    }
  }
  console.log('');
}

main();