#!/usr/bin/env node

/**
 * scrape-freespace.mjs
 * Scrapes free workspace data (libraries, community centres, etc.)
 * Sources: LCSD, Home Affairs Department
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'freespace.json');

// LCSD facilities API (libraries, community centres)
const LCSD_URL = 'https://www.lcsd.gov.hk/ghs/data/facilities.json';

// Home Affairs community centres
const HOME_AFFAIRS_URL = 'https://www.homeaffairs.gov.hk/data/community-centres.json';

const DISTRICT_MAP = {
    '中西區': '中西區',
    '灣仔': '灣仔區',
    '灣仔區': '灣仔區',
    '東區': '東區',
    '南區': '南區',
    '油尖旺': '油尖旺區',
    '油尖旺區': '油尖旺區',
    '深水埗': '深水埗區',
    '深水埗區': '深水埗區',
    '九龍城': '九龍城區',
    '九龍城區': '九龍城區',
    '黃大仙': '黃大仙區',
    '黃大仙區': '黃大仙區',
    '觀塘': '觀塘區',
    '觀塘區': '觀塘區',
    '葵青': '葵青區',
    '葵青區': '葵青區',
    '荃灣': '荃灣區',
    '荃灣區': '荃灣區',
    '屯門': '屯門區',
    '屯門區': '屯門區',
    '元朗': '元朗區',
    '元朗區': '元朗區',
    '北區': '北區',
    '大埔': '大埔區',
    '大埔區': '大埔區',
    '沙田': '沙田區',
    '沙田區': '沙田區',
    '西貢': '西貢區',
    '西貢區': '西貢區',
    '離島': '離島區',
    '離島區': '離島區'
};

function generateId(name, lat, lng) {
    const hash = `${name}-${lat}-${lng}`.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    return `freespace-${Math.abs(hash).toString(36).slice(0, 8)}`;
}

function normalizeDistrict(district) {
    return DISTRICT_MAP[district] || district || '';
}

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function scrapeLCSD() {
    console.log('📚 Scraping LCSD facilities...');

    try {
        const response = await fetchWithTimeout(LCSD_URL);

        if (!response.ok) {
            console.warn(`⚠️  LCSD API returned ${response.status}`);
            return [];
        }

        const data = await response.json();
        const facilities = data.features || data.results || data.data || [];

        return facilities
            .filter(f => {
                const type = (f.properties?.type || f.type || '').toLowerCase();
                return type.includes('library') ||
                       type.includes('圖書館') ||
                       type.includes('community') ||
                       type.includes('社區');
            })
            .map(f => {
                const props = f.properties || f;
                const coords = f.geometry?.coordinates || [props.lng, props.lat];

                return {
                    id: generateId(props.name_tc || props.name, coords[1], coords[0]),
                    name: props.name_tc || props.name || '未知',
                    name_en: props.name_en || props.name || '',
                    lat: coords[1],
                    lng: coords[0],
                    district: normalizeDistrict(props.district_tc || props.district),
                    type: 'free',
                    hours: props.opening_hours || props.hours || '09:00 - 20:00',
                    wifi: true,
                    power: true,
                    category: props.type_tc || props.type || '社區設施',
                    note: props.remark_tc || props.remark || '',
                    source: 'LCSD Open Data',
                    updated: new Date().toISOString().split('T')[0]
                };
            });
    } catch (error) {
        console.error(`❌ LCSD scraping failed: ${error.message}`);
        return [];
    }
}

async function scrapeHomeAffairs() {
    console.log('🏛️ Scraping Home Affairs community centres...');

    try {
        const response = await fetchWithTimeout(HOME_AFFAIRS_URL);

        if (!response.ok) {
            console.warn(`⚠️  Home Affairs API returned ${response.status}`);
            return [];
        }

        const data = await response.json();
        const centres = data.features || data.results || data.data || [];

        return centres
            .filter(f => {
                const type = (f.properties?.type || f.type || '').toLowerCase();
                return type.includes('community') ||
                       type.includes('社區') ||
                       type.includes('recreation') ||
                       type.includes('文娛');
            })
            .map(f => {
                const props = f.properties || f;
                const coords = f.geometry?.coordinates || [props.lng, props.lat];

                return {
                    id: generateId(props.name_tc || props.name, coords[1], coords[0]),
                    name: props.name_tc || props.name || '未知',
                    name_en: props.name_en || props.name || '',
                    lat: coords[1],
                    lng: coords[0],
                    district: normalizeDistrict(props.district_tc || props.district),
                    type: 'free',
                    hours: props.opening_hours || props.hours || '08:00 - 22:00',
                    wifi: true,
                    power: false,
                    category: '社區中心',
                    note: props.remark_tc || props.remark || '',
                    source: 'Home Affairs Open Data',
                    updated: new Date().toISOString().split('T')[0]
                };
            });
    } catch (error) {
        console.error(`❌ Home Affairs scraping failed: ${error.message}`);
        return [];
    }
}

function saveData(freespace) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(freespace, null, 2), 'utf-8');
    console.log(`✅ Saved ${freespace.length} free spaces to ${OUTPUT_FILE}`);
}

async function main() {
    console.log('💺 Starting freespace scraping...');

    const [lcsdData, homeAffairsData] = await Promise.all([
        scrapeLCSD(),
        scrapeHomeAffairs()
    ]);

    const allData = [...lcsdData, ...homeAffairsData];

    if (allData.length === 0) {
        console.log('⚠️  No data scraped, keeping existing seed data');
        try {
            readFileSync(OUTPUT_FILE, 'utf-8');
            console.log('✅ Existing seed data preserved');
        } catch (e) {
            console.log('📝 Creating minimal sample data...');
            saveData([{
                id: 'freespace-sample-001',
                name: '香港中央圖書館',
                name_en: 'Hong Kong Central Library',
                lat: 22.28291,
                lng: 114.18574,
                district: '灣仔區',
                type: 'free',
                hours: '09:00 - 20:00',
                wifi: true,
                power: true,
                category: '圖書館',
                note: 'Sample data - 需要更新為真實數據',
                source: 'Sample data',
                updated: new Date().toISOString().split('T')[0]
            }]);
        }
        return;
    }

    saveData(allData);
}

main().catch(console.error);
