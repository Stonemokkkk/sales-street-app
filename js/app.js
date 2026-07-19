// ===== Global State =====
let allData = { toilets: [], freespace: [], charging: [], premium: [] };
let communityData = [];
let currentTab = 'toilets';
let currentFilter = 'all';
let currentDistrict = '';
let currentKeyword = '';
let sortBy = 'distance'; // 'distance' or 'rating'
let userLat = null;
let userLng = null;
let map = null;
let markers = [];

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadAll();
    initEventListeners();
});

// ===== Map Initialization =====
function initMap() {
    map = L.map('map').setView([22.3193, 114.1694], 11); // Hong Kong center
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// ===== Load All Data =====
async function loadAll() {
    try {
        const [toilets, freespace, charging, premium] = await Promise.all([
            fetch('data/toilets.json').then(r => r.json()),
            fetch('data/freespace.json').then(r => r.json()),
            fetch('data/charging.json').then(r => r.json()),
            fetch('data/premium_toilets.json').then(r => r.json())
        ]);

        allData = { toilets, freespace, charging, premium };

        // Load community data if Supabase is configured
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            await loadCommunity();
        }

        buildDistrictDropdown();
        render();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ===== Load Community Data from Supabase =====
async function loadCommunity() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/places?approved=eq.true&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        if (response.ok) {
            const places = await response.json();
            communityData = places.map(p => ({
                id: `community-${p.id}`,
                name: p.name,
                name_en: '',
                lat: p.lat,
                lng: p.lng,
                district: p.district || '',
                type: p.type || 'free',
                hours: p.hours || '',
                wifi: p.wifi || false,
                power: p.power || false,
                accessible: false,
                baby: false,
                category: '',
                kind: '',
                rating: p.rating || null,
                note: p.note || '',
                source: 'Community report',
                updated: p.created_at?.split('T')[0] || ''
            }));

            // Add community data to appropriate categories
            communityData.forEach(item => {
                if (item.layer === 'toilets' || !item.layer) {
                    allData.toilets.push(item);
                } else if (item.layer === 'freespace') {
                    allData.freespace.push(item);
                } else if (item.layer === 'charging') {
                    allData.charging.push(item);
                } else if (item.layer === 'premium') {
                    allData.premium.push(item);
                }
            });
        }
    } catch (error) {
        console.warn('Supabase not configured or error:', error.message);
    }
}

// ===== Build District Dropdown =====
function buildDistrictDropdown() {
    const select = document.getElementById('districtSelect');
    const districts = new Set();

    Object.values(allData).flat().forEach(item => {
        if (item.district) districts.add(item.district);
    });

    // Sort districts
    const sorted = Array.from(districts).sort();
    sorted.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        select.appendChild(option);
    });
}

// ===== Haversine Distance =====
function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ===== Current Items =====
function currentItems() {
    let items = [...allData[currentTab]];

    // Apply free/paid filter
    if (currentFilter !== 'all') {
        items = items.filter(item => item.type === currentFilter);
    }

    // Apply district filter
    if (currentDistrict) {
        items = items.filter(item => item.district === currentDistrict);
    }

    // Apply keyword search
    if (currentKeyword) {
        const kw = currentKeyword.toLowerCase();
        items = items.filter(item => {
            const searchable = [
                item.name, item.name_en, item.district,
                item.note, item.category, item.kind
            ].filter(Boolean).join(' ').toLowerCase();
            return searchable.includes(kw);
        });
    }

    // Compute distance
    items.forEach(item => {
        if (userLat !== null && userLng !== null) {
            item._distance = distanceKm(userLat, userLng, item.lat, item.lng);
        } else {
            item._distance = Infinity;
        }
    });

    // Sort
    if (sortBy === 'distance') {
        items.sort((a, b) => a._distance - b._distance);
    } else if (sortBy === 'rating') {
        items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return items;
}

// ===== Render =====
function render() {
    renderList();
    renderMarkers();
}

// ===== Render List =====
function renderList() {
    const panel = document.getElementById('listPanel');
    const items = currentItems();

    if (items.length === 0) {
        panel.innerHTML = '<div class="card" style="text-align:center;color:var(--text-secondary)">暫無數據</div>';
        return;
    }

    panel.innerHTML = items.map(item => {
        const distanceText = item._distance !== Infinity
            ? `${item._distance.toFixed(1)}km`
            : '';

        const stars = item.rating ? renderStars(item.rating) : '';

        const badgeType = item.type === 'free'
            ? '<span class="badge badge-free">免費</span>'
            : '<span class="badge badge-paid">收費</span>';

        const tags = [];
        if (item.wifi) tags.push('📶WiFi');
        if (item.power) tags.push('🔌插座');
        if (item.accessible) tags.push('♿無障礙');
        if (item.baby) tags.push('👶育嬰');
        if (item.category) tags.push(item.category);
        if (item.kind) tags.push(item.kind);

        const meta = [
            item.district,
            item.hours ? `🕒${item.hours}` : '',
            item.price ? `💰${item.price}` : ''
        ].filter(Boolean).join(' · ');

        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=walking`;
        const placeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}&center=${item.lat},${item.lng}`;

        return `
            <div class="card" onclick="onCardClick(event, ${item.lat}, ${item.lng})">
                <div class="card-header">
                    <div class="card-name">${item.name}</div>
                    <div class="card-distance">${distanceText}</div>
                </div>
                ${stars}
                <div class="badge-row">
                    ${badgeType}
                    ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
                ${meta ? `<div class="card-meta">${meta}</div>` : ''}
                ${item.note ? `<div class="card-note">${item.note}</div>` : ''}
                <div class="card-source">${item.source} · ${item.updated}</div>
                <div class="card-actions">
                    <a href="${navUrl}" class="btn-nav btn-nav-primary" target="_blank" onclick="event.stopPropagation()">🧭 導航</a>
                    <a href="${placeUrl}" class="btn-nav btn-nav-ghost" target="_blank" onclick="event.stopPropagation()">📍 睇位置</a>
                </div>
            </div>
        `;
    }).join('');
}

// ===== Render Stars =====
function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;

    let html = '<div class="stars">';
    for (let i = 0; i < full; i++) html += '★';
    for (let i = 0; i < half; i++) html += '½';
    for (let i = 0; i < empty; i++) html += '<span class="star-empty">★</span>';
    html += ` ${rating}</div>`;
    return html;
}

// ===== Render Markers =====
function renderMarkers() {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const items = currentItems();

    items.forEach(item => {
        if (item.lat && item.lng) {
            const marker = L.marker([item.lat, item.lng])
                .addTo(map)
                .bindPopup(`
                    <b>${item.name}</b><br>
                    ${item.district || ''}<br>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=walking" target="_blank">🧭 導航</a>
                `);
            markers.push(marker);
        }
    });

    // Fit bounds if we have markers
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// ===== Card Click =====
function onCardClick(event, lat, lng) {
    // Ignore clicks on links
    if (event.target.tagName === 'A') return;

    map.setView([lat, lng], 16);

    // Find and open the marker popup
    markers.forEach(m => {
        const mLatLng = m.getLatLng();
        if (Math.abs(mLatLng.lat - lat) < 0.0001 && Math.abs(mLatLng.lng - lng) < 0.0001) {
            m.openPopup();
        }
    });
}

// ===== Locate User =====
function locateUser(silent) {
    if (!navigator.geolocation) {
        if (!silent) alert('你的瀏覽器不支持定位功能');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;

            // Add user marker
            L.circleMarker([userLat, userLng], {
                radius: 8,
                fillColor: '#0d6efd',
                fillOpacity: 1,
                color: 'white',
                weight: 2
            }).addTo(map).bindPopup('📍 你的位置');

            map.setView([userLat, userLng], 14);
            render();
        },
        (error) => {
            if (!silent) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        alert('定位權限被拒絕');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        alert('位置信息不可用');
                        break;
                    case error.TIMEOUT:
                        alert('定位請求超時');
                        break;
                    default:
                        alert('定位失敗');
                }
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

// ===== Toggle Sort =====
function toggleSort() {
    const btn = document.getElementById('sortToggle');
    if (sortBy === 'distance') {
        sortBy = 'rating';
        btn.textContent = '↕️ 按評分';
    } else {
        sortBy = 'distance';
        btn.textContent = '↕️ 按距離';
    }
    render();
}

// ===== Report Modal =====
function openReportModal() {
    document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
    document.getElementById('reportForm').reset();
}

// ===== Submit Report =====
async function submitReport(e) {
    e.preventDefault();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        alert('報料功能未啟用');
        return;
    }

    const form = e.target;
    const data = {
        layer: form.layer.value,
        name: form.name.value,
        district: form.district.value,
        type: form.type.value,
        lat: parseFloat(form.lat.value),
        lng: parseFloat(form.lng.value),
        hours: form.hours.value || null,
        note: form.note.value || null,
        wifi: form.wifi.checked,
        power: form.power.checked,
        accessible: form.accessible.checked,
        baby: form.baby.checked,
        approved: false
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/places`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('報料已提交，等待審核');
            closeReportModal();
        } else {
            alert('提交失敗，請稍後再試');
        }
    } catch (error) {
        alert('提交失敗：' + error.message);
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;

            // Default sort: premium tab defaults to rating, others to distance
            if (currentTab === 'premium') {
                sortBy = 'rating';
                document.getElementById('sortToggle').textContent = '↕️ 按評分';
            } else {
                sortBy = 'distance';
                document.getElementById('sortToggle').textContent = '↕️ 按距離';
            }

            render();
        });
    });

    // Filter chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            render();
        });
    });

    // Search input (debounced)
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentKeyword = e.target.value;
            render();
        }, 200);
    });

    // District select
    document.getElementById('districtSelect').addEventListener('change', (e) => {
        currentDistrict = e.target.value;
        render();
    });

    // Close modal on backdrop click
    document.getElementById('reportModal').addEventListener('click', (e) => {
        if (e.target.id === 'reportModal') {
            closeReportModal();
        }
    });

    // Auto-locate on load
    locateUser(true);
}
