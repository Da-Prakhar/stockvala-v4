import axios from 'axios';
import { BrokerSetting } from '../models/index.js';
import { successResponse } from '../utils/response.js';
import { redis } from '../redis/client.js';

export const getPublicSettings = async (req, res, next) => {
  try {
    const keys = [
      // Branding — all DB-driven, zero hardcoding
      'companyName', 'logoUrl', 'faviconUrl', 'platform_name',
      // Theme colors — set by each broker's admin for SaaS white-labeling
      'primaryColor', 'secondaryColor', 'accentColor',
      // Contact / social
      'email', 'phone', 'address', 'facebook',
      'twitter', 'linkedin', 'instagram', 'footerText', 'disclaimer'
    ];

    const map = {};

    // 1. Find all known keys regardless of category
    const keyRows = await BrokerSetting.findAll({ where: { key: keys } });
    keyRows.forEach(s => { map[s.key] = s.value; });

    // 2. Also sweep category-based rows (company/branding/general)
    const catRows = await BrokerSetting.findAll({
      where: { category: ['company', 'branding', 'general'] }
    });
    catRows.forEach(s => {
      if (s.type === 'json') {
        try { map[s.key] = JSON.parse(s.value); } catch { map[s.key] = s.value; }
      } else {
        // don't overwrite a key-level value with a category-level one unless missing
        if (!map[s.key]) map[s.key] = s.value;
      }
    });

    // 3. Legacy single-key 'company' blob
    if (!map.companyName) {
      const legacy = await BrokerSetting.findOne({ where: { key: 'company' } });
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy.value);
          Object.assign(map, parsed);
        } catch {
          map.companyName = legacy.value;
        }
      }
    }

    // 4. platform_name is an alternative key for company name
    if (!map.companyName && map.platform_name) {
      map.companyName = map.platform_name;
    }

    // Return exactly what the DB has — no hardcoded fallbacks.
    // Frontend components already handle empty strings gracefully.
    const publicSettings = {
      // Core branding — never fallback to hardcoded company names
      companyName:    map.companyName    || '',
      logoUrl:        map.logoUrl        || null,
      faviconUrl:     map.faviconUrl     || null,
      // SaaS theme colors — each broker sets their own in admin settings
      primaryColor:   map.primaryColor   || '',
      secondaryColor: map.secondaryColor || '',
      accentColor:    map.accentColor    || '',
      // Contact / social
      email:          map.email          || '',
      phone:          map.phone          || '',
      address:        map.address        || '',
      facebook:       map.facebook       || '',
      twitter:        map.twitter        || '',
      linkedin:       map.linkedin       || '',
      instagram:      map.instagram      || '',
      footerText:     map.footerText     || '',
      disclaimer:     map.disclaimer     || '',
    };

    res.json(successResponse(publicSettings, 'Public settings retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a legal/policy page by slug.
 * Stored in BrokerSettings with key = `page_<slug>`
 * Value is JSON: { title, content, lastUpdated }
 */
export const getPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const allowedSlugs = ['terms', 'privacy', 'risk-disclosure', 'compliance', 'about'];
    if (!allowedSlugs.includes(slug)) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    const setting = await BrokerSetting.findOne({ where: { key: `page_${slug}` } });
    if (!setting) {
      const defaults = await getDefaultPageContent(slug);
      return res.json(successResponse(defaults, 'Page content retrieved (default)'));
    }

    let pageData = {};
    try {
      pageData = JSON.parse(setting.value);
    } catch (e) {
      pageData = { title: slug, content: setting.value };
    }
    res.json(successResponse(pageData, 'Page content retrieved'));
  } catch (error) {
    next(error);
  }
};

async function getCompanyNameFromDB() {
  try {
    const setting = await BrokerSetting.findOne({ where: { key: 'companyName' } });
    if (setting?.value) return setting.value;
    const legacy = await BrokerSetting.findOne({ where: { key: 'company' } });
    if (legacy?.value) {
      try { return JSON.parse(legacy.value).companyName || legacy.value; } catch { return legacy.value; }
    }
  } catch { /* ignore */ }
  return process.env.COMPANY_NAME || '';
}

async function getDefaultPageContent(slug) {
  const companyName = await getCompanyNameFromDB();
  const defaults = {
    terms: {
      title: 'Terms & Conditions',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. Acceptance of Terms', body: `By accessing and using the ${companyName} platform, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.` },
        { heading: '2. Account Registration', body: 'You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use our services.' },
        { heading: '3. Trading Risks', body: 'Trading in financial instruments involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. You should carefully consider whether trading is suitable for you in light of your financial condition. You acknowledge that you are solely responsible for your trading decisions.' },
        { heading: '4. Copy Trading Disclaimer', body: 'Copy trading allows you to replicate trades of other traders. However, past performance of any master trader is not a guarantee of future performance. You should set appropriate risk limits and monitor your copy trading positions regularly.' },
        { heading: '5. Deposits and Withdrawals', body: 'All deposit and withdrawal requests are subject to verification. We reserve the right to request additional documentation for KYC/AML compliance. Processing times may vary depending on the payment method selected.' },
        { heading: '6. Prohibited Activities', body: 'You agree not to use our platform for any illegal activities, money laundering, terrorist financing, or any activity that violates applicable laws and regulations. We reserve the right to suspend or terminate accounts that engage in prohibited activities.' },
        { heading: '7. Limitation of Liability', body: `${companyName} shall not be liable for any direct, indirect, incidental, consequential, or exemplary damages arising from your use of the platform, including but not limited to trading losses, system outages, or unauthorized access to your account.` },
        { heading: '8. Modifications', body: 'We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of the platform after any changes constitutes acceptance of the modified terms.' },
        { heading: '9. Contact', body: `For questions about these terms, please contact our support team through the Support page.` },
      ]
    },
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. Information We Collect', body: 'We collect personal information you provide during registration, including your name, email address, phone number, and identification documents for KYC verification. We also collect trading activity data, device information, and usage analytics.' },
        { heading: '2. How We Use Your Information', body: 'Your information is used to provide and improve our services, process transactions, verify your identity, comply with legal obligations, prevent fraud, and communicate with you about your account and platform updates.' },
        { heading: '3. Data Security', body: 'We implement industry-standard security measures to protect your personal and financial data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure.' },
        { heading: '4. Data Sharing', body: 'We do not sell your personal information to third parties. We may share your data with payment processors, regulatory authorities as required by law, and service providers who assist in operating our platform under strict confidentiality agreements.' },
        { heading: '5. KYC Documents', body: 'Identity documents submitted for KYC verification are stored securely and used solely for compliance purposes. Documents are retained as required by applicable regulations and deleted when no longer needed.' },
        { heading: '6. Cookies', body: 'We use cookies and similar technologies to maintain your session, remember your preferences, and improve our services. You can control cookie settings through your browser preferences.' },
        { heading: '7. Your Rights', body: 'You have the right to access, correct, or delete your personal data. You may request a copy of the data we hold about you. To exercise these rights, contact our support team.' },
        { heading: '8. Data Retention', body: 'We retain your personal data for as long as your account is active and as required by applicable laws. Trading records may be retained for a minimum of 5 years as required by financial regulations.' },
        { heading: '9. Contact', body: `For privacy-related inquiries, please contact us through the Support page.` },
      ]
    },
    'risk-disclosure': {
      title: 'Risk Disclosure',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. General Risk Warning', body: 'Trading in Forex, Commodities (MCX), and Stock Markets (NSE) involves significant risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite.' },
        { heading: '2. Market Risk', body: 'Financial markets are subject to periods of high volatility and price fluctuations. Past performance is not indicative of future results. The value of your investments can go down as well as up, and you may lose more than your initial deposit.' },
        { heading: '3. Leverage Risk', body: 'Trading with leverage means that you can control a large position with a relatively small amount of capital. While leverage can amplify profits, it can equally amplify losses. You could lose all of your invested capital.' },
        { heading: '4. Technology Risk', body: 'Electronic trading systems, including MetaTrader 5, are subject to risks including system failure, internet connectivity issues, and software errors. These risks could result in delayed execution, incorrect fills, or inability to access your account.' },
        { heading: '5. Copy Trading Risk', body: 'Copy trading does not guarantee profits. The performance of master traders may not continue in the future. You should monitor your positions regularly and set appropriate stop-loss levels.' },
        { heading: '6. Regulatory Risk', body: 'Changes in laws and regulations may affect the availability of trading instruments, leverage levels, and the overall operation of the platform.' },
        { heading: '7. No Guaranteed Returns', body: `${companyName} does not guarantee any returns on your investments. All trading decisions are made at your own risk. You should never invest money that you cannot afford to lose.` },
      ]
    },
    compliance: {
      title: 'Compliance',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: '1. Anti-Money Laundering (AML)', body: `${companyName} is committed to preventing money laundering and terrorist financing. We maintain strict AML policies and procedures in accordance with applicable laws and regulations.` },
        { heading: '2. Know Your Customer (KYC)', body: 'All clients are required to complete KYC verification before trading. This includes providing valid government-issued identification, proof of address, and in some cases, proof of source of funds.' },
        { heading: '3. Sanctions Compliance', body: 'We comply with all applicable international sanctions regimes. We screen all clients against relevant sanctions lists and do not provide services to sanctioned individuals or entities.' },
        { heading: '4. Data Protection', body: 'We comply with applicable data protection laws. Your personal information is collected, processed, and stored in accordance with our Privacy Policy.' },
        { heading: '5. Reporting Obligations', body: 'We report suspicious transactions to relevant authorities as required by law. We maintain records of all transactions for the periods required by applicable regulations.' },
        { heading: '6. Client Fund Protection', body: 'Client funds are held in segregated accounts separate from company funds. This ensures that your funds are protected in the event of company insolvency.' },
        { heading: '7. Complaint Handling', body: 'We have a formal complaints procedure. If you have a complaint, please contact our support team. We aim to acknowledge complaints within 24 hours and resolve them within 5 business days.' },
      ]
    },
    about: {
      title: 'About Us',
      lastUpdated: new Date().toISOString(),
      sections: [
        { heading: 'Our Mission', body: `${companyName} is a modern trading platform providing access to Forex, Commodities (MCX), and Stock Markets (NSE). We offer advanced trading tools, copy trading, MAM/PAMM accounts, and a seamless trading experience powered by MetaTrader 5 technology. Our mission is to make professional-grade trading accessible to everyone.` },
      ]
    }
  };
  return defaults[slug] || { title: slug, sections: [] };
}

/**
 * GET /api/public/prices?symbols=EURUSD,GBPUSD,XAUUSD,...
 *
 * Returns latest price snapshot for each symbol.
 * Source priority: Redis cache → MT5 gateway REST fallback.
 * No auth required — used by the Flutter Markets screen on initial load.
 *
 * Response: { success: true, data: [{ symbol, bid, ask, t, source }, ...] }
 */
export const getPrices = async (req, res, next) => {
  try {
    const raw = req.query.symbols;
    if (!raw) return res.status(400).json({ success: false, message: 'symbols query param required' });

    const symbols = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 50);

    // 1. Batch-read from Redis — race with 1s timeout so ioredis offline-queue
    //    doesn't cause the request to hang for 30 s when Redis is down.
    let redisResults = null;
    try {
      const pipe = redis.pipeline();
      symbols.forEach(sym => pipe.get(`price:${sym}`));
      const redisTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 1000)
      );
      redisResults = await Promise.race([pipe.exec(), redisTimeout]);
    } catch { /* Redis unavailable or timed out — fall through to gateway */ }

    const prices = [];
    const missing = [];

    symbols.forEach((sym, i) => {
      const val = redisResults?.[i]?.[1];   // [1] = value, [0] = error
      if (val) {
        try {
          const d = JSON.parse(val);
          if (d.bid > 0) {
            prices.push({ symbol: sym, bid: d.bid, ask: d.ask || d.bid, t: d.t || 0, source: 'redis' });
            return;
          }
        } catch { /* fall through to gateway */ }
      }
      missing.push(sym);
    });

    // 2. Gateway fallback for symbols not in Redis
    const gwUrl = process.env.MT5_GATEWAY_URL;
    if (gwUrl && missing.length > 0) {
      await Promise.allSettled(missing.map(async sym => {
        try {
          const r = await axios.get(`${gwUrl}/tick/${sym}`, { timeout: 3000 });
          const d = r.data;
          if (d?.bid > 0) {
            prices.push({ symbol: sym, bid: d.bid, ask: d.ask || d.bid, t: d.time || 0, source: 'gateway' });
          }
        } catch { /* symbol unavailable on gateway */ }
      }));
    }

    res.json(successResponse(prices, 'Prices retrieved'));
  } catch (error) {
    next(error);
  }
};

export default { getPublicSettings, getPage, getPrices };
