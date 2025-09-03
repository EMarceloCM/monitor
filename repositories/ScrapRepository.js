const knex = require('../database/connection');

class ScrapRepository {
    async findAll() {
        try {
            return await knex.select('*').from('scrap').orderBy('id', 'desc');
        } catch (error) {
            console.error('Error fetching scraps: ', error);
            return { error: `Error fetching scraps: ${error}` };
        }
    }

    async findAllWithPagination(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        try {
            const scraps = await knex.select('*').from('scrap').orderBy('id', 'desc').limit(limit).offset(offset);
            const [{ count }] = await knex('scrap').count('id as count');
            return { scraps, total: count };
        } catch (error) {
            console.error('Error fetching scraps with pagination: ', error);
            return { error: `Error fetching scraps with pagination: ${error}` };
        }
    }

    async create(establishment, city, state, platform, link, reviews, last_review) {
        try {
            const creationDate = new Date().toISOString().split('T')[0].replace(/-/g, '/');
            const [id] = await knex('scrap').insert({
                establishment,
                city,
                state,
                platform,
                link,
                reviews,
                last_review,
                createdAt: creationDate
            });
            return { id, establishment, city, state, platform, link, reviews, last_review, createAt: creationDate };
        } catch (error) {
            console.error('Error creating scrap: ', error);
            return { error: `Error creating scrap: ${error}` };
        }
    }

    async findByFilters(filters, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        try {
            const query = knex.select('*').from('scrap').orderBy('id', 'desc');
            if (filters.city) {
                query.where('city', 'like', `%${filters.city}%`);
            }
            if (filters.state) {
                query.where('state', 'like', `%${filters.state}%`);
            }
            if (filters.platform) {
                query.where('platform', 'like', `%${filters.platform}%`);
            }
            if (filters.date) {
                const [year, month] = filters.date.split('-');
                query.whereRaw(
                    'DATE_FORMAT(createdAt, "%Y") = ? AND DATE_FORMAT(createdAt, "%m") = ?',
                    [year, month]
                );
            }
            const scraps = await query.limit(limit).offset(offset);
            const countQuery = knex('scrap').count('id as count');
            if (filters.city) {
                countQuery.where('city', 'like', `%${filters.city}%`);
            }
            if (filters.state) {
                countQuery.where('state', 'like', `%${filters.state}%`);
            }
            if (filters.platform) {
                countQuery.where('platform', 'like', `%${filters.platform}%`);
            }
            if (filters.date) {
                const [year, month] = filters.date.split('-');
                countQuery.whereRaw(
                    'DATE_FORMAT(createdAt, "%Y") = ? AND DATE_FORMAT(createdAt, "%m") = ?',
                    [year, month]
                );
            }
            const [{ count }] = await countQuery;
            return { scraps, total: count };
        } catch (error) {
            console.error('Error fetching scraps with filters: ', error);
            return { error: `Error fetching scraps with filters: ${error}` };
        }
    }

    async exportToCSV(filters) {
        try {
            const { scraps } = await this.findByFilters(filters, 1, Number.MAX_SAFE_INTEGER);
            if (scraps.error) {
                return { error: scraps.error };
            }
            const headers = ['id', 'establishment', 'city', 'state', 'platform', 'link', 'reviews', 'last_review', 'createdAt'];
            const csvRows = [
                headers.join(','),
                ...scraps.map(scrap => headers.map(header => `"${(scrap[header] || '').toString().replace(/"/g, '""')}"`).join(','))
            ];
            return csvRows.join('\n');
        } catch (error) {
            console.error('Error exporting scraps to CSV: ', error);
            return { error: `Error exporting scraps to CSV: ${error}` };
        }
    }

    async exportToExcel(filters) {
        try {
            const { scraps } = await this.findByFilters(filters, 1, Number.MAX_SAFE_INTEGER);
            if (scraps.error) {
                return { error: scraps.error };
            }
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Scraps');
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Establishment', key: 'establishment', width: 30 },
                { header: 'City', key: 'city', width: 20 },
                { header: 'State', key: 'state', width: 10 },
                { header: 'Platform', key: 'platform', width: 20 },
                { header: 'Link', key: 'link', width: 40 },
                { header: 'Reviews', key: 'reviews', width: 10 },
                { header: 'Last Review', key: 'last_review', width: 15 },
                { header: 'Created At', key: 'createdAt', width: 15 }
            ];
            scraps.forEach(scrap => {
                worksheet.addRow(scrap);
            });
            const buffer = await workbook.xlsx.writeBuffer();
            return buffer;
        } catch (error) {
            console.error('Error exporting scraps to Excel: ', error);
            return { error: `Error exporting scraps to Excel: ${error}` };
        }
    }

    async getStats() {
        try {
            const rows = await knex('scrap').select(
                'id',
                'establishment',
                'city',
                'state',
                'platform',
                'link',
                'reviews',
                'last_review',
                'createdAt'
            );

            if (!rows.length) {
                return {
                    platformStats: [],
                    kpis: {},
                    lastUpdated: null,
                    topByReviews: [],
                    topByGrowth: [],
                    topCities: []
                };
            }

            const totalEstablishments = new Set(rows.map(r => r.establishment)).size;
            const totalReviews = rows.reduce((sum, r) => sum + (r.reviews || 0), 0);
            const avgReviewsPerEstablishment = totalReviews / (totalEstablishments || 1);

            const daysSinceLastReview = rows
                .map(r => {
                    if (!r.last_review) return null;
                    const diff = (new Date(r.createdAt) - new Date(r.last_review)) / (1000 * 60 * 60 * 24);
                    return diff >= 0 ? diff : null;
                })
                .filter(v => v !== null)
                .sort((a, b) => a - b);

            const mid = Math.floor(daysSinceLastReview.length / 2);
            const medianDaysSinceLastReview = daysSinceLastReview.length
                ? (daysSinceLastReview.length % 2 !== 0
                    ? daysSinceLastReview[mid]
                    : (daysSinceLastReview[mid - 1] + daysSinceLastReview[mid]) / 2)
                : 0;

            const active30d = rows.filter(r => r.last_review && (new Date() - new Date(r.last_review)) / (1000 * 60 * 60 * 24) <= 30);
            const pctActive30d = totalEstablishments ? active30d.length / totalEstablishments : 0;

            const kpis = {
                totalEstablishments,
                totalReviews,
                avgReviewsPerEstablishment,
                medianDaysSinceLastReview,
                pctActive30d
            };

            // ---- platformStats (remove plataformas sem reviews)
            const groupByPlatform = {};
            rows.forEach(r => {
                if (!groupByPlatform[r.platform]) {
                    groupByPlatform[r.platform] = { establishments: new Set(), reviews: 0 };
                }
                groupByPlatform[r.platform].establishments.add(r.establishment);
                groupByPlatform[r.platform].reviews += r.reviews || 0;
            });

            const platformStats = Object.keys(groupByPlatform)
                .map(platform => ({
                    platform,
                    establishments: groupByPlatform[platform].establishments.size,
                    reviews: groupByPlatform[platform].reviews
                }))
                .filter(p => p.reviews > 0);

            // ---- topByReviews
            const topByReviews = [...rows]
                .filter(r => r.reviews > 0)
                .sort((a, b) => (b.reviews || 0) - (a.reviews || 0))
                .slice(0, 10)
                .map(r => ({
                    name: r.establishment,
                    platform: r.platform,
                    city: r.city,
                    state: r.state,
                    link: r.link,
                    reviews: r.reviews
                }));

            // ---- topByGrowth
            const history = {};
            rows.forEach(r => {
                if (!history[r.establishment]) history[r.establishment] = [];
                history[r.establishment].push(r);
            });
            const growth = [];
            Object.keys(history).forEach(establishment => {
                const sorted = history[establishment].sort(
                    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
                );
                if (sorted.length >= 2) {
                    const first = sorted[0].reviews || 0;
                    const lastRecord = sorted[sorted.length - 1];
                    const last = lastRecord.reviews || 0;
                    const pct = first ? (last - first) / first : 0;
                    growth.push({
                        name: establishment,
                        platform: lastRecord.platform,
                        city: lastRecord.city,
                        state: lastRecord.state,
                        link: lastRecord.link,
                        growthPct: pct
                    });
                }
                });
            const topByGrowth = growth.sort((a, b) => b.growthPct - a.growthPct).slice(0, 10);

            // ---- topCities
            const cityGroup = {};
            rows.forEach(r => {
                if (!r.city || !r.state) return;
                const key = `${r.city}-${r.state}`;
                if (!cityGroup[key]) cityGroup[key] = { city: r.city, state: r.state, sum: 0, count: 0 };
                cityGroup[key].sum += r.reviews || 0;
                cityGroup[key].count += 1;
            });
            const topCities = Object.values(cityGroup)
                .map(c => ({ city: c.city, state: c.state, avgReviews: c.count ? c.sum / c.count : 0, count: c.count }))
                .sort((a, b) => b.avgReviews - a.avgReviews)
                .slice(0, 10);

            return {
                platformStats,
                kpis,
                lastUpdated: new Date().toLocaleString('pt-BR'),
                topByReviews,
                topByGrowth,
                topCities
            };
        } catch (error) {
            console.error('Error fetching stats: ', error);
            return { error: `Error fetching stats: ${error}` };
        }
    }
}

module.exports = new ScrapRepository();