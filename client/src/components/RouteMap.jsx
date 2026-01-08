import { GoogleMap, useJsApiLoader, Polyline, InfoWindow, OverlayView } from '@react-google-maps/api';
import { useState, useCallback, useEffect } from 'react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Libraries to load
const libraries = ['geometry'];

const defaultCenter = { lat: 13.0827, lng: 80.2707 }; // Chennai

const mapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
    { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
    { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
    { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
    { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
    { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
    { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const containerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '12px',
};

// Color palette for different transporters
const TRANSPORTER_COLORS = [
    '#6366f1', // Primary
    '#d946ef', // Accent
    '#10b981', // Success
    '#f59e0b', // Warning
    '#ef4444', // Error
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
];

export default function RouteMap({
    origin,
    destination,
    waypoints = [],
    checkpoints = [],
    routes = [],
    onMapClick,
    showMarkers = true,
    fitBounds = true,
    height = '500px'
}) {
    const [map, setMap] = useState(null);
    const [selectedMarker, setSelectedMarker] = useState(null);

    // Use the hook to load Google Maps API (prevents duplicate loading)
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        id: 'google-map-script',
        libraries: libraries,
    });

    const onLoad = useCallback((map) => {
        setMap(map);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    // Fit bounds to show all markers
    useEffect(() => {
        if (map && fitBounds) {
            const bounds = new window.google.maps.LatLngBounds();
            let hasPoints = false;

            if (origin) {
                bounds.extend(origin);
                hasPoints = true;
            }
            if (destination) {
                bounds.extend(destination);
                hasPoints = true;
            }
            waypoints.forEach(wp => {
                bounds.extend(wp);
                hasPoints = true;
            });
            checkpoints.forEach(cp => {
                if (cp.lat && cp.lng) {
                    bounds.extend({ lat: cp.lat, lng: cp.lng });
                    hasPoints = true;
                }
            });
            routes.forEach(route => {
                route.path?.forEach(point => {
                    bounds.extend(point);
                    hasPoints = true;
                });
            });

            if (hasPoints) {
                map.fitBounds(bounds, { padding: 50 });
            }
        }
    }, [map, origin, destination, waypoints, checkpoints, routes, fitBounds]);

    const handleMapClick = (e) => {
        if (onMapClick) {
            onMapClick({
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
            });
        }
    };

    if (!GOOGLE_MAPS_API_KEY) {
        return (
            <div className="map-placeholder" style={{ height }}>
                <div className="map-placeholder-content">
                    <p>🗺️ Map Preview</p>
                    <p className="text-sm">Configure VITE_GOOGLE_MAPS_API_KEY to enable maps</p>
                    {origin && destination && (
                        <div className="route-info">
                            <p><strong>Origin:</strong> {origin.address || `${origin.lat}, ${origin.lng}`}</p>
                            <p><strong>Destination:</strong> {destination.address || `${destination.lat}, ${destination.lng}`}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="map-placeholder" style={{ height }}>
                <div className="map-placeholder-content">
                    <p>❌ Map Error</p>
                    <p className="text-sm">Failed to load Google Maps</p>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="map-placeholder" style={{ height }}>
                <div className="map-placeholder-content">
                    <p>🗺️ Loading Map...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ height }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={origin || defaultCenter}
                zoom={10}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapClick}
                options={{
                    styles: mapStyles,
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                }}
            >
                    {/* Origin Marker - Custom div instead of deprecated Marker */}
                    {showMarkers && origin && (
                        <OverlayView
                            position={origin}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div 
                                className="custom-marker origin-marker"
                                onClick={() => setSelectedMarker({ type: 'origin', ...origin })}
                                title="Origin"
                            >
                                <div className="marker-dot" style={{ backgroundColor: '#10b981' }}></div>
                            </div>
                        </OverlayView>
                    )}

                    {/* Destination Marker */}
                    {showMarkers && destination && (
                        <OverlayView
                            position={destination}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div 
                                className="custom-marker destination-marker"
                                onClick={() => setSelectedMarker({ type: 'destination', ...destination })}
                                title="Destination"
                            >
                                <div className="marker-dot" style={{ backgroundColor: '#ef4444' }}></div>
                            </div>
                        </OverlayView>
                    )}

                    {/* Waypoint Markers */}
                    {showMarkers && waypoints.map((wp, index) => (
                        <OverlayView
                            key={`waypoint-${index}`}
                            position={wp}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div 
                                className="custom-marker waypoint-marker"
                                onClick={() => setSelectedMarker({ type: 'waypoint', index, ...wp })}
                            >
                                <span>{index + 1}</span>
                            </div>
                        </OverlayView>
                    ))}

                    {/* Checkpoint Markers */}
                    {showMarkers && checkpoints.map((cp, index) => (
                        cp.lat && cp.lng && (
                            <OverlayView
                                key={`checkpoint-${index}`}
                                position={{ lat: cp.lat, lng: cp.lng }}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div 
                                    className={`custom-marker checkpoint-marker ${cp.is_handoff ? 'handoff' : ''}`}
                                    onClick={() => setSelectedMarker({ type: 'checkpoint', ...cp })}
                                    title={cp.is_handoff ? 'Handoff Point' : 'Checkpoint'}
                                >
                                    <div className="marker-arrow"></div>
                                </div>
                            </OverlayView>
                        )
                    ))}

                    {/* Route Polylines */}
                    {routes.map((route, index) => (
                        <Polyline
                            key={`route-${index}`}
                            path={route.path}
                            options={{
                                strokeColor: route.color || TRANSPORTER_COLORS[index % TRANSPORTER_COLORS.length],
                                strokeOpacity: 0.8,
                                strokeWeight: 5,
                            }}
                        />
                    ))}

                    {/* Info Window */}
                    {selectedMarker && (
                        <InfoWindow
                            position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                            onCloseClick={() => setSelectedMarker(null)}
                        >
                            <div className="info-window">
                                {selectedMarker.type === 'origin' && (
                                    <>
                                        <h4>📍 Origin</h4>
                                        <p>{selectedMarker.address || 'Starting Point'}</p>
                                    </>
                                )}
                                {selectedMarker.type === 'destination' && (
                                    <>
                                        <h4>🎯 Destination</h4>
                                        <p>{selectedMarker.address || 'End Point'}</p>
                                    </>
                                )}
                                {selectedMarker.type === 'waypoint' && (
                                    <>
                                        <h4>📌 Waypoint {selectedMarker.index + 1}</h4>
                                        <p>{selectedMarker.address || `Stop ${selectedMarker.index + 1}`}</p>
                                    </>
                                )}
                                {selectedMarker.type === 'checkpoint' && (
                                    <>
                                        <h4>{selectedMarker.is_handoff ? '🔄 Handoff Point' : '📍 Checkpoint'}</h4>
                                        <p><strong>Location:</strong> {selectedMarker.location}</p>
                                        <p><strong>Status:</strong> {selectedMarker.status}</p>
                                        <p><strong>Time:</strong> {new Date(selectedMarker.timestamp).toLocaleString()}</p>
                                    </>
                                )}
                            </div>
                        </InfoWindow>
                    )}
                </GoogleMap>
        </div>
    );
}

// Styles for the map placeholder
const placeholderStyles = `
.map-placeholder {
  background: var(--dark-surface);
  border: 2px dashed var(--dark-border);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.map-placeholder-content {
  color: var(--dark-text-secondary);
}

.map-placeholder-content p:first-child {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.route-info {
  margin-top: var(--space-4);
  text-align: left;
  background: rgba(255, 255, 255, 0.05);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
}

.info-window {
  color: #333;
  padding: 8px;
}

.info-window h4 {
  color: #333;
  margin-bottom: 4px;
}

.info-window p {
  color: #666;
  margin: 2px 0;
  font-size: 13px;
}

/* Custom Markers (replacement for deprecated google.maps.Marker) */
.custom-marker {
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: transform 0.15s ease;
}

.custom-marker:hover {
  transform: translate(-50%, -50%) scale(1.2);
}

.marker-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.waypoint-marker {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 12px;
}

.checkpoint-marker {
  width: 20px;
  height: 20px;
  background: #6366f1;
  border: 2px solid white;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.checkpoint-marker.handoff {
  background: #d946ef;
}

.marker-arrow {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid white;
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = placeholderStyles;
    document.head.appendChild(style);
}
