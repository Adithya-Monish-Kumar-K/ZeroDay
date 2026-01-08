import { useState, useCallback } from 'react';
import { routesApi, optimizeApi } from '../api';
import RouteMap from '../components/RouteMap';
import {
    MapPin, Plus, Trash2, Navigation, Zap, Clock,
    Truck, ArrowRight, Shuffle
} from 'lucide-react';
import './RoutePlanner.css';

// Google Maps API key for browser-side geocoding
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Decode Google Maps encoded polyline to array of lat/lng points
function decodePolyline(encoded) {
    if (!encoded) return [];
    
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        points.push({
            lat: lat / 1e5,
            lng: lng / 1e5
        });
    }

    return points;
}

export default function RoutePlanner() {
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [waypoints, setWaypoints] = useState([]);
    const [originAddress, setOriginAddress] = useState('');
    const [destAddress, setDestAddress] = useState('');
    const [waypointInput, setWaypointInput] = useState('');
    const [routeInfo, setRouteInfo] = useState(null);
    const [routePath, setRoutePath] = useState([]); // Decoded road path for map display
    const [optimizedRoute, setOptimizedRoute] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState('');

    // Browser-side geocoding using Google Maps Geocoder (works with HTTP referrer restrictions)
    const geocodeAddress = useCallback(async (address) => {
        // Check if Google Maps is loaded
        if (window.google && window.google.maps && window.google.maps.Geocoder) {
            return new Promise((resolve, reject) => {
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ address }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        resolve({
                            lat: results[0].geometry.location.lat(),
                            lng: results[0].geometry.location.lng(),
                            address: results[0].formatted_address
                        });
                    } else if (status === 'ZERO_RESULTS') {
                        reject(new Error(`No location found for "${address}"`));
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });
        }
        
        // Fallback: Use fetch to Google Geocoding API directly from browser
        if (GOOGLE_MAPS_API_KEY) {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 'OK' && data.results[0]) {
                return {
                    lat: data.results[0].geometry.location.lat,
                    lng: data.results[0].geometry.location.lng,
                    address: data.results[0].formatted_address
                };
            }
            throw new Error(data.status === 'ZERO_RESULTS' ? `No location found for "${address}"` : `Geocoding failed: ${data.status}`);
        }
        
        // Final fallback: Use server API (for mock geocoding)
        const response = await routesApi.geocode(address);
        if (response.data.status === 'OK' && response.data.results?.[0]) {
            const result = response.data.results[0];
            return {
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                address: result.formatted_address
            };
        }
        throw new Error(response.data.status === 'ZERO_RESULTS' ? `No location found for "${address}"` : 'Geocoding failed');
    }, []);

    const handleAddressSearch = async (type) => {
        const address = type === 'origin' ? originAddress : type === 'destination' ? destAddress : waypointInput;
        if (!address || address.trim().length < 2) return;

        setIsGeocoding(true);
        setGeocodeError('');
        try {
            const location = await geocodeAddress(address);
            console.log('Geocoded location:', location);

            if (type === 'origin') {
                setOrigin(location);
            } else if (type === 'destination') {
                setDestination(location);
            } else if (type === 'waypoint') {
                setWaypoints([...waypoints, location]);
                setWaypointInput('');
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
            setGeocodeError(error.message || 'Failed to search location.');
        }
        setIsGeocoding(false);
    };

    const handleCalculateRoute = async () => {
        if (!origin || !destination) return;

        setIsLoading(true);
        setGeocodeError('');
        try {
            // Step 1: Use the optimizer engine for route planning
            let optimizerData = null;
            try {
                const optimizerResponse = await optimizeApi.optimizeOrder(
                    origin,
                    destination ? [destination, ...waypoints] : waypoints,
                    false
                );
                optimizerData = optimizerResponse.data;
                console.log('Optimizer result:', optimizerData);
            } catch (optError) {
                console.warn('Optimizer fallback - using Google Directions:', optError.message);
            }

            // Step 2: Get road geometry from Google Directions for visualization
            if (window.google && window.google.maps && window.google.maps.DirectionsService) {
                const directionsService = new window.google.maps.DirectionsService();
                
                // Use optimizer's optimized order if available, otherwise use input order
                let orderedWaypoints = waypoints;
                if (optimizerData?.optimized_route && optimizerData.optimized_route.length > 2) {
                    // Optimizer returns [origin, ...stops, destination] - extract middle waypoints
                    orderedWaypoints = optimizerData.optimized_route.slice(1, -1);
                }
                
                const waypointsForGoogle = orderedWaypoints.map(wp => ({
                    location: new window.google.maps.LatLng(wp.lat, wp.lng),
                    stopover: true
                }));

                const request = {
                    origin: new window.google.maps.LatLng(origin.lat, origin.lng),
                    destination: new window.google.maps.LatLng(destination.lat, destination.lng),
                    waypoints: waypointsForGoogle,
                    optimizeWaypoints: false, // Already optimized by our engine
                    travelMode: window.google.maps.TravelMode.DRIVING
                };

                directionsService.route(request, (result, status) => {
                    if (status === 'OK' && result.routes[0]) {
                        const route = result.routes[0];
                        
                        // Get the encoded polyline string
                        const encodedPolyline = route.overview_polyline;
                        console.log('Google Directions result:', { status, pathLength: encodedPolyline?.length });
                        
                        // Build route info - prefer optimizer data for distance/duration if available
                        const routeData = {
                            summary: route.summary,
                            legs: route.legs.map(leg => ({
                                distance: { text: leg.distance.text, value: leg.distance.value },
                                duration: { text: leg.duration.text, value: leg.duration.value },
                                start_address: leg.start_address,
                                end_address: leg.end_address
                            })),
                            overview_polyline: { points: encodedPolyline },
                            // Include optimizer data if available
                            optimizer: optimizerData ? {
                                total_distance_km: optimizerData.total_distance_km,
                                estimated_time_hours: optimizerData.estimated_time_hours,
                                savings_percentage: optimizerData.savings_percentage
                            } : null
                        };
                        setRouteInfo(routeData);
                        
                        // Decode the polyline for map display using Google's geometry library
                        if (window.google.maps.geometry?.encoding?.decodePath) {
                            const path = window.google.maps.geometry.encoding.decodePath(encodedPolyline);
                            console.log('Decoded path points:', path.length);
                            setRoutePath(path.map(p => ({ lat: p.lat(), lng: p.lng() })));
                        } else {
                            // Fallback: decode manually
                            const decodedPath = decodePolyline(encodedPolyline);
                            console.log('Manual decoded path points:', decodedPath.length);
                            setRoutePath(decodedPath);
                        }
                    } else {
                        console.error('Google Directions failed:', status);
                        setGeocodeError(`Failed to get road geometry: ${status}`);
                        setRoutePath([]);
                    }
                    setIsLoading(false);
                });
                return;
            }
            
            // Fallback to server API (OSRM)
            const response = await routesApi.getDirections(origin, destination, waypoints);
            const route = response.data.routes?.[0];
            setRouteInfo(route);
            
            if (route?.overview_polyline?.points) {
                const decodedPath = decodePolyline(route.overview_polyline.points);
                setRoutePath(decodedPath);
            } else {
                setRoutePath([]);
            }
            setIsLoading(false);
        } catch (error) {
            console.error('Route calculation failed:', error);
            setGeocodeError('Failed to calculate route.');
            setRoutePath([]);
            setIsLoading(false);
        }
    };

    const handleOptimizeRoute = async () => {
        if (!origin || waypoints.length === 0) return;

        setIsLoading(true);
        try {
            const destinations = destination ? [...waypoints, destination] : waypoints;
            const response = await optimizeApi.optimizeOrder(origin, destinations, true);
            setOptimizedRoute(response.data);
        } catch (error) {
            console.error('Optimization failed:', error);
        }
        setIsLoading(false);
    };

    const removeWaypoint = (index) => {
        setWaypoints(waypoints.filter((_, i) => i !== index));
    };

    return (
        <div className="route-planner">
            <div className="page-header">
                <div>
                    <h1>Route Planner</h1>
                    <p>Plan and optimize your delivery routes</p>
                </div>
            </div>

            <div className="planner-grid">
                {/* Input Panel */}
                <div className="input-panel card">
                    <h3><Navigation size={20} /> Plan Your Route</h3>

                    <div className="input-group">
                        <label>Start Location</label>
                        <div className="location-input">
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter start address..."
                                value={originAddress}
                                onChange={(e) => {
                                    setOriginAddress(e.target.value);
                                    setOrigin(null); // Clear origin when typing
                                    setGeocodeError('');
                                }}
                                onBlur={() => handleAddressSearch('origin')}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('origin')}
                            />
                            <div className={`location-marker origin ${origin ? 'confirmed' : ''}`}></div>
                        </div>
                        {origin && <span className="confirmed-address">✓ {origin.address}</span>}
                        {!origin && originAddress && isGeocoding && <span className="geocoding-text">Searching...</span>}
                    </div>

                    <div className="waypoints-section">
                        <label>Stops (Optional)</label>
                        {waypoints.map((wp, index) => (
                            <div key={index} className="waypoint-item">
                                <span className="waypoint-number">{index + 1}</span>
                                <span className="waypoint-address">{wp.address}</span>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeWaypoint(index)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <div className="location-input">
                            <input
                                type="text"
                                className="input"
                                placeholder="Add a stop..."
                                value={waypointInput}
                                onChange={(e) => setWaypointInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('waypoint')}
                            />
                            <button className="btn btn-ghost btn-icon" onClick={() => handleAddressSearch('waypoint')}>
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="input-group">
                        <label>End Location</label>
                        <div className="location-input">
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter destination address..."
                                value={destAddress}
                                onChange={(e) => {
                                    setDestAddress(e.target.value);
                                    setDestination(null); // Clear destination when typing
                                    setGeocodeError('');
                                }}
                                onBlur={() => handleAddressSearch('destination')}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('destination')}
                            />
                            <div className={`location-marker destination ${destination ? 'confirmed' : ''}`}></div>
                        </div>
                        {destination && <span className="confirmed-address">✓ {destination.address}</span>}
                        {!destination && destAddress && isGeocoding && <span className="geocoding-text">Searching...</span>}
                    </div>

                    {/* Error message */}
                    {geocodeError && (
                        <div className="geocode-error">
                            ⚠️ {geocodeError}
                        </div>
                    )}

                    <div className="action-buttons">
                        <button
                            className="btn btn-primary"
                            onClick={handleCalculateRoute}
                            disabled={!origin || !destination || isLoading}
                        >
                            <ArrowRight size={18} />
                            Calculate Route
                        </button>
                        {waypoints.length > 0 && (
                            <button
                                className="btn btn-accent"
                                onClick={handleOptimizeRoute}
                                disabled={isLoading}
                            >
                                <Zap size={18} />
                                Optimize Order
                            </button>
                        )}
                    </div>

                    {/* Route Summary */}
                    {routeInfo && (
                        <div className="route-summary">
                            <h4>Route Summary</h4>
                            <div className="summary-stats">
                                <div className="summary-stat">
                                    <Truck size={20} />
                                    <div>
                                        <span className="stat-value">
                                            {routeInfo.legs?.length > 1
                                                ? `${(routeInfo.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0) / 1000).toFixed(1)} km`
                                                : routeInfo.legs?.[0]?.distance?.text || 'N/A'
                                            }
                                        </span>
                                        <span className="stat-label">Total Distance</span>
                                    </div>
                                </div>
                                <div className="summary-stat">
                                    <Clock size={20} />
                                    <div>
                                        <span className="stat-value">
                                            {routeInfo.legs?.length > 1
                                                ? (() => {
                                                    const totalSeconds = routeInfo.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
                                                    const hours = Math.floor(totalSeconds / 3600);
                                                    const mins = Math.floor((totalSeconds % 3600) / 60);
                                                    return hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
                                                })()
                                                : routeInfo.legs?.[0]?.duration?.text || 'N/A'
                                            }
                                        </span>
                                        <span className="stat-label">Est. Duration</span>
                                    </div>
                                </div>
                            </div>
                            {/* Optimizer info */}
                            {routeInfo.optimizer && routeInfo.optimizer.savings_percentage > 0 && (
                                <div className="optimizer-savings">
                                    <Zap size={16} />
                                    <span>Optimized! Saved {routeInfo.optimizer.savings_percentage}% distance</span>
                                </div>
                            )}
                            {/* Show leg breakdown for multi-stop routes */}
                            {routeInfo.legs?.length > 1 && (
                                <div className="route-legs">
                                    <h5>Route Breakdown</h5>
                                    {routeInfo.legs.map((leg, index) => (
                                        <div key={index} className="route-leg-item">
                                            <span className="leg-number">{index + 1}</span>
                                            <span className="leg-details">
                                                {leg.start_address?.split(',')[0]} → {leg.end_address?.split(',')[0]}
                                            </span>
                                            <span className="leg-distance">{leg.distance?.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Optimized Route */}
                    {optimizedRoute && (
                        <div className="optimized-result">
                            <h4><Shuffle size={18} /> Optimized Route</h4>
                            <p className="savings">
                                {optimizedRoute.savings_percentage > 0
                                    ? `🎉 Saves ${optimizedRoute.savings_percentage}% distance!`
                                    : 'Current order is optimal'
                                }
                            </p>
                            <div className="optimized-stops">
                                {optimizedRoute.optimized_route?.map((stop, index) => (
                                    <div key={index} className="optimized-stop">
                                        <span className="stop-number">{index + 1}</span>
                                        <span className="stop-address">{stop.address}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="optimized-stats">
                                <span>Total: {Math.round(optimizedRoute.total_distance_km)} km</span>
                                <span>~{optimizedRoute.estimated_time_hours} hours</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Map Panel */}
                <div className="map-panel card">
                    <RouteMap
                        height="100%"
                        origin={origin}
                        destination={destination}
                        waypoints={waypoints}
                        routes={routePath.length > 0 ? [{ path: routePath, color: '#6366f1' }] : []}
                    />
                </div>
            </div>
        </div>
    );
}
