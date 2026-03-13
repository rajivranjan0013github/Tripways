/**
 * Country map utilities for the My Spots colored country map feature.
 * Handles matching user-entered country names to GeoJSON features,
 * assigning colors, and computing centroids for badge placement.
 */

// Bright, neon-like high-contrast colors for country fills
export const COUNTRY_COLORS = [
    '#D00050', // Vibrant Deep Rose
    '#00A86B', // Vibrant Jade
    '#0055D0', // Electric Deep Blue
    '#C09000', // Rich Gold
    '#6A0DAD', // Vibrant Deep Purple
    '#D35400', // Deep Burnt Orange
    '#008000', // Rich Emerald
    '#C71585', // Medium Violet Red
    '#008B8B', // Dark Cyan
    '#B22222', // Firebrick Red
    '#191970', // Midnight Blue (Vibrant version)
    '#556B2F', // Dark Olive
    '#800000', // Maroon (Vibrant Maroon)
    '#4B0082', // Indigo
];

/**
 * Common country name aliases → the ADMIN name in Natural Earth GeoJSON.
 * Google Places API may return these shortened or alternate names.
 */
const COUNTRY_ALIASES = {
    'usa': 'United States of America',
    'us': 'United States of America',
    'united states': 'United States of America',
    'uk': 'United Kingdom',
    'england': 'United Kingdom',
    'scotland': 'United Kingdom',
    'wales': 'United Kingdom',
    'northern ireland': 'United Kingdom',
    'great britain': 'United Kingdom',
    'russia': 'Russia',
    'south korea': 'South Korea',
    'north korea': 'North Korea',
    'czech republic': 'Czechia',
    'ivory coast': "Côte d'Ivoire",
    'cote d\'ivoire': "Côte d'Ivoire",
    'tanzania': 'United Republic of Tanzania',
    'democratic republic of the congo': 'Democratic Republic of the Congo',
    'congo': 'Republic of the Congo',
    'dr congo': 'Democratic Republic of the Congo',
    'drc': 'Democratic Republic of the Congo',
    'uae': 'United Arab Emirates',
    'vatican': 'Vatican',
    'vatican city': 'Vatican',
    'myanmar': 'Myanmar',
    'burma': 'Myanmar',
    'laos': 'Laos',
    'iran': 'Iran',
    'syria': 'Syria',
    'vietnam': 'Vietnam',
    'viet nam': 'Vietnam',
    'bolivia': 'Bolivia',
    'venezuela': 'Venezuela',
    'taiwan': 'Taiwan',
    'palestine': 'Palestine',
    'eswatini': 'eSwatini',
    'swaziland': 'eSwatini',
    'netherlands': 'Netherlands',
    'holland': 'Netherlands',
    'the netherlands': 'Netherlands',
    'türkiye': 'Turkey',
    'turkiye': 'Turkey',
};

/**
 * Normalize a country name for matching: lowercase, trim, remove diacritics.
 */
function normalize(name) {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // strip diacritics
}

/**
 * Build a lookup map from the GeoJSON features for fast matching.
 * Keys: normalized ADMIN name, normalized NAME, ISO_A2, ISO_A3
 * Value: index into the features array
 */
export function buildCountryLookup(geojsonFeatures) {
    const lookup = {};
    geojsonFeatures.forEach((feature, index) => {
        const props = feature.properties;
        if (props.ADMIN) lookup[normalize(props.ADMIN)] = index;
        if (props.NAME) lookup[normalize(props.NAME)] = index;
        if (props.ISO_A2) lookup[props.ISO_A2.toLowerCase()] = index;
        if (props.ISO_A3) lookup[props.ISO_A3.toLowerCase()] = index;
    });
    return lookup;
}

/**
 * Find the GeoJSON feature index for a given country name.
 */
export function findCountryFeatureIndex(countryName, lookup) {
    const norm = normalize(countryName);

    // 1. Direct match on normalized name
    if (lookup[norm] !== undefined) return lookup[norm];

    // 2. Check aliases
    const alias = COUNTRY_ALIASES[norm];
    if (alias) {
        const aliasNorm = normalize(alias);
        if (lookup[aliasNorm] !== undefined) return lookup[aliasNorm];
    }

    // 3. Partial match — check if any key contains the normalized name or vice versa
    for (const [key, idx] of Object.entries(lookup)) {
        if (key.length > 2 && (key.includes(norm) || norm.includes(key))) {
            return idx;
        }
    }

    return -1;
}

/**
 * Compute the centroid (center point) of a GeoJSON geometry
 * by averaging the bounding box corners. Good enough for marker placement.
 */
export function computeCentroid(geometry) {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    function processCoord(coord) {
        const [lng, lat] = coord;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }

    function processCoords(coords) {
        if (typeof coords[0] === 'number') {
            processCoord(coords);
            return;
        }
        coords.forEach(processCoords);
    }

    processCoords(geometry.coordinates);

    return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
    };
}

/**
 * Some countries have invalid or missing ISO_A2 codes in our GeoJSON (-99).
 * This map provides a fallback to ensure flag emoji markers show correctly.
 */
const ISO_FALLBACKS = {
    'France': 'FR',
    'Norway': 'NO',
    'Northern Cyprus': 'TR', // Using Turkey flag for Northern Cyprus
    'Somaliland': 'SO', // Using Somalia flag for Somaliland
    'Kosovo': 'XK', // XK is the user-assigned ISO code for Kosovo
};

/**
 * Convert an ISO 3166-1 alpha-2 country code (e.g. "IN") to a flag emoji (e.g. "🇮🇳").
 * Works by mapping each letter to a Regional Indicator Symbol.
 */
export function isoCodeToFlagEmoji(isoA2) {
    if (!isoA2 || isoA2 === '-99' || isoA2.length !== 2) return '🏳️';
    const code = isoA2.toUpperCase();
    return String.fromCodePoint(
        ...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
    );
}

/**
 * Given the savedSpots grouped object (country → cities) and the full GeoJSON,
 * produce an array of { color, centroid, spotCount, countryName, flagEmoji }
 * for rendering on the map.
 */
export function getCountryMapData(savedSpotsGrouped, geojsonData) {
    if (!savedSpotsGrouped || !geojsonData?.features) return [];

    const lookup = buildCountryLookup(geojsonData.features);
    const countries = Object.keys(savedSpotsGrouped);
    const result = [];

    countries.forEach((countryName, i) => {
        const featureIndex = findCountryFeatureIndex(countryName, lookup);
        if (featureIndex < 0) {
            console.log(`[CountryMap] No GeoJSON match for: "${countryName}"`);
            return;
        }

        const feature = geojsonData.features[featureIndex];
        const cities = savedSpotsGrouped[countryName];
        const spotCount = Object.values(cities || {}).reduce(
            (sum, city) => sum + (city?.spots?.length || 0),
            0
        );

        const color = COUNTRY_COLORS[i % COUNTRY_COLORS.length];
        const centroid = computeCentroid(feature.geometry);
        let isoA2 = feature.properties?.ISO_A2 || '';
        
        // Use fallback if the GeoJSON has -99 or missing code
        if (!isoA2 || isoA2 === '-99') {
            const adminName = feature.properties?.ADMIN;
            if (ISO_FALLBACKS[adminName]) {
                isoA2 = ISO_FALLBACKS[adminName];
            }
        }

        const flagEmoji = isoCodeToFlagEmoji(isoA2);

        result.push({
            color,
            centroid,
            spotCount,
            countryName,
            flagEmoji,
        });
    });

    return result;
}
