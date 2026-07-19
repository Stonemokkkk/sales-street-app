#!/usr/bin/env node

/**
 * scrape-charging.mjs
 * Scrapes charging station data (power bank rental, USB charging)
 * Sources: Various charging station operators
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'charging.json');

// Known charging station operators in Hong Kong
const CHARGING_SOURCES = [
    {
        name: 'ChargeSpot',
        url: 'https://chargespot.hk/api/stations',
        type: 'paid',
        kind: '尿袋租借'
    },
    {
        name: 'PowerDot',
        url: 'https://powerdot.hk/api/stations',
        type: 'paid',
        kind: '尿袋租借'
    },
    {
        name: 'Free2Move',
        url: 'https://free2move.hk/api/stations',
        type: 'free',
        kind: 'USB 充電'
    }
];

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
    return `charging-${Math.abs(hash).toString(36).slice(0, 8)}`;
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

async function scrapeChargingSource(source) {
    console.log(`🔋 Scraping ${source.name}...`);

    try {
        const response = await fetchWithTimeout(source.url);

        if (!response.ok) {
            console.warn(`⚠️  ${source.name} API returned ${response.status}`);
            return [];
        }

        const data = await response.json();
        const stations = data.features || data.results || data.data || data.stations || [];

        return stations.map(station => {
            const props = station.properties || station;
            const coords = station.geometry?.coordinates || [props.lng, props.lat];

            return {
                id: generateId(props.name || source.name, coords[1], coords[0]),
                name: props.name_tc || props.name || `${source.name} 充電站`,
                name_en: props.name_en || props.name || `${source.name} Charging Station`,
                lat: coords[1],
                lng: coords[0],
                district: normalizeDistrict(props.district_tc || props.district),
                type: source.type,
                hours: props.opening_hours || props.hours || '09:00 - 21:00',
                wifi: false,
                power: true,
                kind: source.kind,
                price: source.type === 'paid' ? (props.price || '$10/30min') : null,
                note: props.remark_tc || props.remark || '',
                source: source.name,
                updated: new Date().toISOString().split('T')[0]
            };
        });
    } catch (error) {
        console.error(`❌ ${source.name} scraping failed: ${error.message}`);
        return [];
    }
}

function saveData(charging) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(charging, null, 2), 'utf-8');
    console.log(`✅ Saved ${charging.length} charging stations to ${OUTPUT_FILE}`);
}

async function main() {
    console.log('🔋 Starting charging station scraping...');

    const results = await Promise.all(
        CHARGING_SOURCES.map(source => scrapeChargingSource(source))
    );

    const allData = results.flat();

    if (allData.length === 0) {
        console.log('⚠️  No data scraped, keeping existing seed data');
        try {
            readFileSync(OUTPUT_FILE, 'utf-8');
            console.log('✅ Existing seed data preserved');
        } catch (e) {
            console.log('📝 Creating minimal sample data...');
            saveData([{
                id: 'charging-sample-001',
                name: '中環 charging dot',
                name_en: 'Central Charging Dot',
                lat: 22.28405,
                lng: 114.15453,
                district: '中西區',
                type: 'paid',
                hours: '09:00 - 21:00',
                wifi: false,
                power: true,
                kind: '尿袋租借',
                price: '$10/30min',
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
