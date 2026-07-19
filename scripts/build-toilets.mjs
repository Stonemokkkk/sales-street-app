#!/usr/bin/env node

/**
 * build-toilets.mjs
 * Fetches FEHD facility & service locations CSV from data.gov.hk
 * Filters rows where type contains "toilet"/"廁"
 * Maps to unified schema and writes data/toilets.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT_FILE = join(DATA_DIR, 'toilets.json');

// FEHD facility & service locations dataset
// This URL may change - verify against https://data.gov.hk
const SOURCE_URL = process.env.FEHD_URL ||
    'https://data.gov.hk/en-data/dataset/hk-isd-isd-info-1-facility-location';

// District mapping (English to Chinese)
const DISTRICT_MAP = {
    'Central and Western': '中西區',
    'Wan Chai': '灣仔區',
    'Eastern': '東區',
    'Southern': '南區',
    'Yau Tsim Mong': '油尖旺區',
    'Sham Shui Po': '深水埗區',
    'Kowloon City': '九龍城區',
    'Wong Tai Sin': '黃大仙區',
    'Kwun Tong': '觀塘區',
    'Kwai Tsing': '葵青區',
    'Tsuen Wan': '荃灣區',
    'Tuen Mun': '屯門區',
    'Yuen Long': '元朗區',
    'North': '北區',
    'Tai Po': '大埔區',
    'Sha Tin': '沙田區',
    'Sai Kung': '西貢區',
    'Islands': '離島區'
};

/**
 * Parse CSV with quoted field support
 */
function parseCSV(text) {
    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                current.push(field.trim());
                field = '';
            } else if (char === '\n' || (char === '\r' && next === '\n')) {
                current.push(field.trim());
                if (current.length > 0 && current.some(f => f)) {
                    rows.push(current);
                }
                current = [];
                field = '';
                if (char === '\r') i++;
            } else {
                field += char;
            }
        }
    }

    // Last field
    if (field || current.length > 0) {
        current.push(field.trim());
        if (current.length > 0 && current.some(f => f)) {
            rows.push(current);
        }
    }

    return rows;
}

/**
 * Fuzzy match column header
 */
function findColumn(headers, patterns) {
    for (const pattern of patterns) {
        const idx = headers.findIndex(h =>
            h.toLowerCase().includes(pattern.toLowerCase())
        );
        if (idx !== -1) return idx;
    }
    return -1;
}

/**
 * Generate unique ID
 */
function generateId(name, lat, lng) {
    const hash = `${name}-${lat}-${lng}`.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    return `toilet-${Math.abs(hash).toString(36).slice(0, 8)}`;
}

/**
 * Main function
 */
async function main() {
    console.log('🚻 Fetching FEHD toilet data...');

    try {
        // Try to fetch from data.gov.hk
        const response = await fetch(SOURCE_URL);

        if (!response.ok) {
            console.warn(`⚠️  Failed to fetch from ${SOURCE_URL}: ${response.status}`);
            console.log('📝 Using fallback: creating sample data...');
            createSampleData();
            return;
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('json')) {
            // JSON API response
            const data = await response.json();
            processJSONData(data);
        } else if (contentType.includes('csv') || contentType.includes('text')) {
            // CSV response
            const text = await response.text();
            const rows = parseCSV(text);
            processCSVData(rows);
        } else {
            console.warn(`⚠️  Unexpected content type: ${contentType}`);
            createSampleData();
        }
    } catch (error) {
        console.error(`❌ Error fetching data: ${error.message}`);
        console.log('📝 Using fallback: creating sample data...');
        createSampleData();
    }
}

/**
 * Process JSON data from API
 */
function processJSONData(data) {
    const facilities = data.features || data.results || data.data || [];

    const toilets = facilities
        .filter(f => {
            const type = (f.properties?.type || f.type || '').toLowerCase();
            return type.includes('toilet') || type.includes('廁') || type.includes('wc');
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
                district: DISTRICT_MAP[props.district_en] || props.district_tc || '',
                type: 'free',
                hours: props.opening_hours || props.hours || '',
                wifi: false,
                power: false,
                accessible: props.wheelchair === 'Y' || props.accessible === true,
                baby: props.baby_facilities === 'Y' || props.baby === true,
                note: props.remark_tc || props.remark || '',
                source: 'FEHD Open Data',
                updated: new Date().toISOString().split('T')[0]
            };
        });

    saveData(toilets);
}

/**
 * Process CSV data
 */
function processCSVData(rows) {
    if (rows.length < 2) {
        console.warn('⚠️  No data rows found in CSV');
        createSampleData();
        return;
    }

    const headers = rows[0];

    // Find relevant columns
    const nameTCIdx = findColumn(headers, ['name_tc', '中文名稱', '名稱']);
    const nameENIdx = findColumn(headers, ['name_en', 'english_name', '英文名稱']);
    const latIdx = findColumn(headers, ['latitude', '緯度', 'lat']);
    const lngIdx = findColumn(headers, ['longitude', '經度', 'lng', 'long']);
    const districtIdx = findColumn(headers, ['district', '地區']);
    const typeIdx = findColumn(headers, ['type', '類別', '設施類型']);
    const hoursIdx = findColumn(headers, ['opening_hours', 'hours', '營業時間']);
    const wheelchairIdx = findColumn(headers, ['wheelchair', '無障礙']);

    console.log(`📊 Found columns: nameTC=${nameTCIdx}, lat=${latIdx}, lng=${lngIdx}, district=${districtIdx}`);

    const toilets = rows.slice(1)
        .filter(row => {
            const type = (row[typeIdx] || '').toLowerCase();
            return type.includes('toilet') || type.includes('廁') || type.includes('wc');
        })
        .map(row => ({
            id: generateId(
                row[nameTCIdx] || 'unknown',
                parseFloat(row[latIdx]) || 0,
                parseFloat(row[lngIdx]) || 0
            ),
            name: row[nameTCIdx] || '未知',
            name_en: row[nameENIdx] || '',
            lat: parseFloat(row[latIdx]) || 22.3193,
            lng: parseFloat(row[lngIdx]) || 114.1694,
            district: DISTRICT_MAP[row[districtIdx]] || row[districtIdx] || '',
            type: 'free',
            hours: row[hoursIdx] || '',
            wifi: false,
            power: false,
            accessible: row[wheelchairIdx]?.toLowerCase() === 'y',
            baby: false,
            note: '',
            source: 'FEHD Open Data',
            updated: new Date().toISOString().split('T')[0]
        }));

    saveData(toilets);
}

/**
 * Create sample data when API is unavailable
 */
function createSampleData() {
    // Read existing seed data if available
    let existing = [];
    try {
        existing = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    } catch (e) {
        // File doesn't exist yet
    }

    if (existing.length > 0) {
        console.log(`✅ Keeping ${existing.length} existing seed records`);
        return;
    }

    // Create minimal sample data
    const sample = [
        {
            id: 'toilet-sample-001',
            name: '中環街市公廁',
            name_en: 'Central Market Public Toilet',
            lat: 22.28405,
            lng: 114.15453,
            district: '中西區',
            type: 'free',
            hours: '06:00 - 00:00',
            wifi: false,
            power: false,
            accessible: true,
            baby: false,
            note: 'Seed data - 需要更新為真實數據',
            source: 'Sample data',
            updated: new Date().toISOString().split('T')[0]
        }
    ];

    saveData(sample);
}

/**
 * Save data to JSON file
 */
function saveData(toilets) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(toilets, null, 2), 'utf-8');
    console.log(`✅ Saved ${toilets.length} toilets to ${OUTPUT_FILE}`);
}

// Run
main().catch(console.error);
