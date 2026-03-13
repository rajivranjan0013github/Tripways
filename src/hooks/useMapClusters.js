import { useMemo, useRef } from 'react';
import SuperclusterModule from 'supercluster';

// Handle ESM default export — Metro bundler may give us { default: Supercluster }
const Supercluster = SuperclusterModule.default || SuperclusterModule;

/**
 * Custom hook that uses supercluster to cluster individual spot markers.
 *
 * @param {Array} spots - Array of spot objects with coordinates.lat/lng, _id, name, color, etc.
 * @param {Object} mapRegion - Current visible map region { latitude, longitude, latitudeDelta, longitudeDelta }
 * @param {number} mapZoomLevel - Current approximate zoom level
 * @returns {Array} clusters - Array of GeoJSON features (clusters + individual points)
 */
export function useMapClusters(spots, mapRegion, mapZoomLevel) {
    // Build the supercluster index when spots change
    const clusterIndex = useMemo(() => {
        if (!spots || spots.length === 0) return null;

        const index = new Supercluster({
            radius: 60,      // Cluster radius in pixels
            maxZoom: 16,      // Max zoom to cluster at
            minZoom: 0,
            minPoints: 2,     // Minimum points to form a cluster
        });

        // Convert spots to GeoJSON points
        const points = spots.map(spot => ({
            type: 'Feature',
            properties: {
                spotId: spot._id || spot.id || spot.placeId,
                name: spot.name,
                color: spot.color,
                spot: spot, // Keep the full spot object for press handling
            },
            geometry: {
                type: 'Point',
                coordinates: [spot.coordinates.lng, spot.coordinates.lat],
            },
        }));

        index.load(points);
        return index;
    }, [spots]);

    // Get clusters for the current viewport
    const clusters = useMemo(() => {
        if (!clusterIndex || !mapRegion) return [];

        // Calculate bounding box from the current region
        const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
        const bbox = [
            longitude - longitudeDelta / 2,  // west
            latitude - latitudeDelta / 2,    // south
            longitude + longitudeDelta / 2,  // east
            latitude + latitudeDelta / 2,    // north
        ];

        // Clamp bbox to valid ranges
        const clampedBbox = [
            Math.max(-180, bbox[0]),
            Math.max(-90, bbox[1]),
            Math.min(180, bbox[2]),
            Math.min(90, bbox[3]),
        ];

        try {
            return clusterIndex.getClusters(clampedBbox, Math.floor(mapZoomLevel));
        } catch (e) {
            console.warn('[useMapClusters] getClusters error:', e);
            return [];
        }
    }, [clusterIndex, mapRegion, mapZoomLevel]);

    /**
     * Get the expansion zoom for a cluster (the zoom level at which it splits).
     */
    const getClusterExpansionZoom = (clusterId) => {
        if (!clusterIndex) return mapZoomLevel + 2;
        try {
            return clusterIndex.getClusterExpansionZoom(clusterId);
        } catch (e) {
            return mapZoomLevel + 2;
        }
    };

    return { clusters, getClusterExpansionZoom };
}
