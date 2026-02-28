// config.js
import { StripHtml, COMMON_KEYWORDS } from './utils.js';
import fetch from 'node-fetch'; // fetch is needed for the getDetails function
import { AbortController } from 'abort-controller';
import {mercedesConfig} from "./CompanyConfig/mercedesConfig.js"
import { datevConfig } from './CompanyConfig/datevConfig.js';
import { tradeRepublicConfig } from './CompanyConfig/tradeRepublicConfig.js';
import { redcarePhramacyConfig } from './CompanyConfig/recarePhramacyConfig.js';
import { almediaConfig } from './CompanyConfig/almediaConfig.js';
import {deutscheTelekomConfig} from './CompanyConfig/deutscheTelekomConfig.js'
import { airbusConfig } from './CompanyConfig/airbusConfig.js';
import { infineonConfig } from './CompanyConfig/infineonConfig.js';
import {heidelbergMaterialsConfig} from './CompanyConfig/heidelbergMaterialsConfig.js' 
import { commerzbankConfig } from './CompanyConfig/commerzbankConfig.js';
import { symriseConfig } from './CompanyConfig/symriseConfig.js';
import { covestroConfig } from './CompanyConfig/covestroConfig.js';
import { brenntagConfig } from './CompanyConfig/brenntagConfig.js';
import { qiagenConfig } from './CompanyConfig/qiagenConfig.js';
import { aldiSudConfig } from './CompanyConfig/aldiSudConfig.js';
import {  lidlDeConfig } from './CompanyConfig/lidlConfig.js';
import { kauflandConfig } from './CompanyConfig/kauflandConfig.js';
import { edekaConfig } from './CompanyConfig/edekaConfig.js';
import { auto1GroupConfig } from './CompanyConfig/auto1GroupConfig.js';
import { sixtConfig } from './CompanyConfig/sixtConfig.js';
import { greenhouseConfig } from './CompanyConfig/greenhouseConfig.js';
import { ashbyConfig } from './CompanyConfig/ashbyConfig.js';
import { leverConfig } from './CompanyConfig/leverConfig.js';

export const SITES_CONFIG = [



  // --------------------------------------
  greenhouseConfig,
  ashbyConfig,

leverConfig 






  

  ];
