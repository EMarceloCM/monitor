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
}

module.exports = new ScrapRepository();