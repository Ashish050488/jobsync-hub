// FILE: src/Db/analytics/hiringTrends.js
// Aggregated market-trend signals for the public Trends page. 1-hour cache.
// Powers: daily posting momentum, role-category demand, experience/workplace
// splits, and top movers (reuses the leaderboard's week-over-week deltas).

import { col } from '../connection.js';
import { getHiringLeaderboard } from './hiringLeaderboard.js';

const TTL_MS = 60 * 60 * 1000;
const WINDOW_DAYS = 60;
const MAX_CATEGORIES = 8;
const MAX_MOVERS = 6;

let cache = null;

function emptyResponse(now) {
  return {
    summary: {
      totalActiveRoles: 0, newThisWeek: 0, newLastWeek: 0,
      wowDelta: 0, wowPercent: 0, categoriesTracked: 0, companiesTracked: 0,
    },
    daily: [],
    categories: [],
    experience: [],
    workplace: [],
    movers: { gaining: [], cooling: [] },
    updatedAt: now.toISOString(),
  };
}

export async function getHiringTrends() {
  if (cache && (Date.now() - cache.timestamp) < TTL_MS) return cache.data;

  const jobs = await col('jobs');
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

  const catMatch = {
    Status: 'active',
    'autoTags.roleCategory': { $exists: true, $ne: null, $type: 'string' },
  };

  try {
    const [dailyRaw, catCurrent, catThis, catLast, expRaw, wpRaw, leaderboard] = await Promise.all([
      // Daily new roles over the trailing window (by first-seen date).
      jobs.aggregate([
        { $match: { Status: 'active', createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
      // Role-category totals + this-week / last-week for momentum.
      jobs.aggregate([
        { $match: catMatch },
        { $group: { _id: '$autoTags.roleCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      jobs.aggregate([
        { $match: { ...catMatch, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$autoTags.roleCategory', count: { $sum: 1 } } },
      ]).toArray(),
      jobs.aggregate([
        { $match: { ...catMatch, createdAt: { $gte: fourteenDaysAgo, $lte: sevenDaysAgo } } },
        { $group: { _id: '$autoTags.roleCategory', count: { $sum: 1 } } },
      ]).toArray(),
      // Experience-band split.
      jobs.aggregate([
        { $match: { Status: 'active', 'autoTags.experienceBand': { $exists: true, $ne: null, $type: 'string' } } },
        { $group: { _id: '$autoTags.experienceBand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      // Workplace split — normalised to Remote / Hybrid / On-site / Unspecified.
      jobs.aggregate([
        { $match: { Status: 'active' } },
        { $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$IsRemote', true] }, then: 'Remote' },
                { case: { $regexMatch: { input: { $ifNull: ['$WorkplaceType', ''] }, regex: 'remote', options: 'i' } }, then: 'Remote' },
                { case: { $regexMatch: { input: { $ifNull: ['$WorkplaceType', ''] }, regex: 'hybrid', options: 'i' } }, then: 'Hybrid' },
                { case: { $regexMatch: { input: { $ifNull: ['$WorkplaceType', ''] }, regex: 'on-?site|office', options: 'i' } }, then: 'On-site' },
              ],
              default: 'Unspecified',
            },
          },
          count: { $sum: 1 },
        } },
        { $sort: { count: -1 } },
      ]).toArray(),
      getHiringLeaderboard(),
    ]);

    // Zero-filled daily series so the chart has one point per day.
    const dailyMap = new Map(dailyRaw.map(d => [d._id, d.count]));
    const daily = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const key = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      daily.push({ date: key, count: dailyMap.get(key) || 0 });
    }

    // Categories with share + week-over-week trend.
    const twMap = new Map(catThis.map(r => [r._id, r.count]));
    const lwMap = new Map(catLast.map(r => [r._id, r.count]));
    const totalCat = catCurrent.reduce((s, c) => s + c.count, 0) || 1;
    const categories = catCurrent
      .filter(c => c._id && typeof c._id === 'string')
      .slice(0, MAX_CATEGORIES)
      .map(c => {
        const tw = twMap.get(c._id) || 0;
        const lw = lwMap.get(c._id) || 0;
        let trendPercent = lw > 0 ? Math.round(((tw - lw) / lw) * 100) : (tw > 0 ? 100 : 0);
        trendPercent = Math.max(-200, Math.min(200, trendPercent));
        return {
          category: c._id,
          totalRoles: c.count,
          share: Math.round((c.count / totalCat) * 100),
          newThisWeek: tw,
          trendPercent,
          trend: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable',
        };
      });

    const experience = expRaw
      .filter(e => e._id && typeof e._id === 'string')
      .map(e => ({ band: e._id, count: e.count }));

    const workplace = wpRaw.map(w => ({ type: w._id, count: w.count }));

    // Movers reuse the leaderboard's week-over-week deltas — no new pipeline.
    const companies = leaderboard?.companies ?? [];
    const toMover = c => ({
      company: c.company,
      delta: c.weekOverWeek ?? 0,
      newThisWeek: c.newThisWeek ?? 0,
      totalRoles: c.totalRoles ?? c.totalActiveRoles ?? 0,
    });
    const gaining = companies
      .filter(c => (c.weekOverWeek ?? 0) > 0)
      .sort((a, b) => (b.weekOverWeek ?? 0) - (a.weekOverWeek ?? 0))
      .slice(0, MAX_MOVERS)
      .map(toMover);
    const cooling = companies
      .filter(c => (c.weekOverWeek ?? 0) < 0)
      .sort((a, b) => (a.weekOverWeek ?? 0) - (b.weekOverWeek ?? 0))
      .slice(0, MAX_MOVERS)
      .map(toMover);

    const newThisWeek = leaderboard?.totalNewThisWeek ?? 0;
    const newLastWeek = leaderboard?.summary?.totalNewLastWeek ?? 0;
    const wowDelta = newThisWeek - newLastWeek;
    const wowPercent = newLastWeek > 0
      ? Math.round((wowDelta / newLastWeek) * 100)
      : (newThisWeek > 0 ? 100 : 0);

    const data = {
      summary: {
        totalActiveRoles: leaderboard?.totalActiveRoles ?? 0,
        newThisWeek,
        newLastWeek,
        wowDelta,
        wowPercent,
        categoriesTracked: categories.length,
        companiesTracked: companies.length,
      },
      daily,
      categories,
      experience,
      workplace,
      movers: { gaining, cooling },
      updatedAt: now.toISOString(),
    };
    cache = { data, timestamp: Date.now() };
    return data;
  } catch (err) {
    console.error('[getHiringTrends]', err);
    if (cache) return cache.data;
    return emptyResponse(now);
  }
}
