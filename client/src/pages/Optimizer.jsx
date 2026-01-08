import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, InfoWindow } from '@react-google-maps/api';
import { MapPin, Navigation, Package, Zap, Clock, DollarSign, Truck, AlertCircle, CheckCircle } from 'lucide-react';
import { optimizeApi } from '../api';
import { useNotificationStore, useShipmentStore } from '../store';
import './Optimizer.css';

const mapContainerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '16px'
};

const defaultCenter = {
    lat: 13.0827,
    lng: 80.2707
};

const PRODUCT_TYPES = [
    { value: 'electronics', label: 'Electronics', icon: '💻' },
    { value: 'medicine', label: 'Medicine', icon: '💊' },
    { value: 'furniture', label: 'Furniture', icon: '🪑' },
    { value: 'perishable', label: 'Perishable', icon: '🥬' },
    { value: 'other', label: 'Other', icon: '📦' }
];

export default function Optimizer() {
    const { addNotification } = useNotificationStore();
    const { shipments, fetchShipments, isLoading: shipmentsLoading } = useShipmentStore();
    
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [selectingPoint, setSelectingPoint] = useState(null); // 'origin' or 'destination'
    const [productType, setProductType] = useState('electronics');
    const [urgency, setUrgency] = useState(1);
    const [weight, setWeight] = useState(500);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [results, setResults] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [showInfo, setShowInfo] = useState(null);
    const [directions, setDirections] = useState(null);
    const mapRef = useRef(null);

    // Fetch shipper's shipments on mount
    useEffect(() => {
        fetchShipments({ status: 'posted' }); // Only fetch posted (unassigned) shipments
    }, []);

    // Fetch road directions when origin and destination are set
    useEffect(() => {
        if (origin && destination && window.google) {
            const directionsService = new window.google.maps.DirectionsService();
            
            directionsService.route(
                {
                    origin: origin,
                    destination: destination,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === 'OK') {
                        setDirections(result);
                    } else {
                        console.error('Directions request failed:', status);
                        setDirections(null);
                    }
                }
            );
        } else {
            setDirections(null);
        }
    }, [origin, destination]);

    // When a shipment is selected, auto-populate the form
    const handleShipmentSelect = (shipmentId) => {
        const shipment = shipments.find(s => s.id === shipmentId);
        if (shipment) {
            setSelectedShipment(shipment);
            setOrigin({ lat: shipment.origin_lat, lng: shipment.origin_lng });
            setDestination({ lat: shipment.dest_lat, lng: shipment.dest_lng });
            setProductType(shipment.cargo_type || 'other');
            setWeight(shipment.weight_kg || 500);
        } else {
            setSelectedShipment(null);
        }
    };

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: ['places']
    });

    const onMapClick = useCallback((e) => {
        const point = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
        };

        if (selectingPoint === 'origin') {
            setOrigin(point);
            setSelectingPoint('destination');
        } else if (selectingPoint === 'destination') {
            setDestination(point);
            setSelectingPoint(null);
        }
    }, [selectingPoint]);

    const handleOptimize = async () => {
        if (!origin || !destination) {
            addNotification({ type: 'error', message: 'Please select a shipment or set origin and destination' });
            return;
        }

        setIsOptimizing(true);
        setResults(null);

        try {
            // Use real shipment ID if a shipment is selected, otherwise generate temp ID
            const shipmentData = selectedShipment 
                ? { id: selectedShipment.id, weight_kg: selectedShipment.weight_kg }
                : { id: `temp-${Date.now()}`, weight_kg: weight };

            const response = await optimizeApi.chainOptimize(
                origin,
                destination,
                productType,
                [shipmentData],
                urgency
            );

            setResults(response.data);
            if (response.data.routes?.length > 0) {
                setSelectedRoute(response.data.routes[0]);
            }
            addNotification({ 
                type: 'success', 
                message: `Found ${response.data.routes?.length || 0} optimized routes!`
            });
        } catch (error) {
            addNotification({ 
                type: 'error', 
                message: error.response?.data?.detail || 'Optimization failed'
            });
        } finally {
            setIsOptimizing(false);
        }
    };

    const resetSelection = () => {
        setOrigin(null);
        setDestination(null);
        setResults(null);
        setSelectedRoute(null);
        setSelectingPoint('origin');
    };

    const getRouteColor = (index) => {
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
        return colors[index % colors.length];
    };

    if (loadError) {
        return (
            <div className="optimizer-error">
                <AlertCircle size={48} />
                <h2>Failed to load Google Maps</h2>
                <p>Please check your API key configuration</p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="optimizer-loading">
                <div className="loading-spinner"></div>
                <p>Loading Maps...</p>
            </div>
        );
    }

    return (
        <div className="optimizer-page">
            <div className="optimizer-header">
                <div className="header-content">
                    <h1><Zap className="header-icon" /> Chain Optimizer</h1>
                    <p>AI-powered multi-transporter route optimization</p>
                </div>
                <div className="optimizer-badge">
                    <span className="badge-dot"></span>
                    OR-Tools VRP
                </div>
            </div>

            <div className="optimizer-grid">
                {/* Left Panel - Controls */}
                <div className="optimizer-controls card glass">
                    {/* Shipment Selector */}
                    <h3><Package size={20} /> Select Shipment</h3>
                    <div className="form-group">
                        <select 
                            className="form-select shipment-select"
                            value={selectedShipment?.id || ''}
                            onChange={(e) => handleShipmentSelect(e.target.value)}
                        >
                            <option value="">-- Select a shipment to optimize --</option>
                            {shipmentsLoading ? (
                                <option disabled>Loading shipments...</option>
                            ) : shipments.length === 0 ? (
                                <option disabled>No posted shipments found</option>
                            ) : (
                                shipments.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.cargo_type} - {s.weight_kg}kg | {s.origin_address?.substring(0, 20)}... → {s.dest_address?.substring(0, 20)}...
                                    </option>
                                ))
                            )}
                        </select>
                        {selectedShipment && (
                            <div className="selected-shipment-info">
                                <span className="shipment-id">ID: {selectedShipment.id.substring(0, 8)}...</span>
                                <span className="shipment-weight">{selectedShipment.weight_kg} kg</span>
                            </div>
                        )}
                    </div>

                    <div className="form-divider"></div>

                    <h3><MapPin size={20} /> Route Selection</h3>
                    
                    <div className="selection-buttons">
                        <button 
                            className={`select-btn ${selectingPoint === 'origin' ? 'active' : ''} ${origin ? 'selected' : ''}`}
                            onClick={() => setSelectingPoint('origin')}
                        >
                            <div className="select-marker origin-marker">A</div>
                            <div className="select-info">
                                <span className="select-label">Origin</span>
                                {origin && (
                                    <span className="select-coords">
                                        {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
                                    </span>
                                )}
                            </div>
                            {origin && <CheckCircle size={16} className="check-icon" />}
                        </button>

                        <button 
                            className={`select-btn ${selectingPoint === 'destination' ? 'active' : ''} ${destination ? 'selected' : ''}`}
                            onClick={() => setSelectingPoint('destination')}
                        >
                            <div className="select-marker dest-marker">B</div>
                            <div className="select-info">
                                <span className="select-label">Destination</span>
                                {destination && (
                                    <span className="select-coords">
                                        {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
                                    </span>
                                )}
                            </div>
                            {destination && <CheckCircle size={16} className="check-icon" />}
                        </button>
                    </div>

                    {selectingPoint && (
                        <div className="selection-hint">
                            <MapPin size={16} />
                            Click on map to select {selectingPoint}
                        </div>
                    )}

                    <div className="form-divider"></div>

                    <h3><Package size={20} /> Shipment Details</h3>

                    <div className="form-group">
                        <label>Product Type</label>
                        <div className="product-grid">
                            {PRODUCT_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    className={`product-btn ${productType === type.value ? 'active' : ''}`}
                                    onClick={() => setProductType(type.value)}
                                >
                                    <span className="product-icon">{type.icon}</span>
                                    <span>{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Weight (kg)</label>
                            <input
                                type="number"
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                min="1"
                                max="50000"
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Urgency</label>
                            <select 
                                value={urgency} 
                                onChange={(e) => setUrgency(Number(e.target.value))}
                                className="form-select"
                            >
                                <option value={1}>Standard</option>
                                <option value={1.5}>Priority</option>
                                <option value={2}>Express</option>
                                <option value={3}>Emergency</option>
                            </select>
                        </div>
                    </div>

                    <div className="action-buttons">
                        <button 
                            className="btn btn-primary optimize-btn"
                            onClick={handleOptimize}
                            disabled={!origin || !destination || isOptimizing}
                        >
                            {isOptimizing ? (
                                <>
                                    <div className="btn-spinner"></div>
                                    Optimizing...
                                </>
                            ) : (
                                <>
                                    <Zap size={18} />
                                    Optimize Route
                                </>
                            )}
                        </button>

                        <button className="btn btn-secondary" onClick={resetSelection}>
                            Reset
                        </button>
                    </div>
                </div>

                {/* Map */}
                <div className="optimizer-map card glass">
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={origin || defaultCenter}
                        zoom={7}
                        onClick={onMapClick}
                        onLoad={(map) => { mapRef.current = map; }}
                        options={{
                            styles: [
                                { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
                                { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
                                { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
                                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
                                { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
                                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1421' }] },
                            ],
                            disableDefaultUI: false,
                            zoomControl: true,
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: true,
                        }}
                    >
                        {/* Origin Marker */}
                        {origin && (
                            <Marker
                                position={origin}
                                label={{ text: 'A', color: 'white', fontWeight: 'bold' }}
                                onClick={() => setShowInfo('origin')}
                            />
                        )}

                        {/* Destination Marker */}
                        {destination && (
                            <Marker
                                position={destination}
                                label={{ text: 'B', color: 'white', fontWeight: 'bold' }}
                                onClick={() => setShowInfo('destination')}
                            />
                        )}

                        {/* Road Route */}
                        {directions && (
                            <DirectionsRenderer
                                directions={directions}
                                options={{
                                    suppressMarkers: true, // We use custom markers
                                    polylineOptions: {
                                        strokeColor: '#10b981',
                                        strokeWeight: 5,
                                        strokeOpacity: 0.8,
                                    },
                                }}
                            />
                        )}

                        {/* Info Windows */}
                        {showInfo === 'origin' && origin && (
                            <InfoWindow position={origin} onCloseClick={() => setShowInfo(null)}>
                                <div className="info-window">
                                    <strong>Origin Point</strong>
                                    <p>{origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}</p>
                                </div>
                            </InfoWindow>
                        )}

                        {showInfo === 'destination' && destination && (
                            <InfoWindow position={destination} onCloseClick={() => setShowInfo(null)}>
                                <div className="info-window">
                                    <strong>Destination Point</strong>
                                    <p>{destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}</p>
                                </div>
                            </InfoWindow>
                        )}
                    </GoogleMap>

                    {/* Map Legend */}
                    {selectedRoute && (
                        <div className="map-legend">
                            <span className="legend-item">
                                <span className="legend-dot" style={{ background: '#10b981' }}></span>
                                Optimized Route
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Section */}
            {results && (
                <div className="optimizer-results">
                    <h2>
                        <Navigation size={24} />
                        Optimization Results
                        <span className="result-badge">{results.optimizer}</span>
                    </h2>

                    {results.routes && results.routes.length > 0 ? (
                        <div className="routes-grid">
                            {results.routes.map((route, index) => (
                                <div 
                                    key={index}
                                    className={`route-card card glass ${selectedRoute === route ? 'selected' : ''}`}
                                    onClick={() => setSelectedRoute(route)}
                                >
                                    <div className="route-header">
                                        <span className="route-number">Route {index + 1}</span>
                                        {index === 0 && <span className="best-badge">Best</span>}
                                    </div>

                                    <div className="route-stats">
                                        <div className="stat">
                                            <DollarSign size={16} />
                                            <span className="stat-value">
                                                ₹{parseFloat(route.total_cost).toFixed(2)}
                                            </span>
                                            <span className="stat-label">Total Cost</span>
                                        </div>

                                        <div className="stat">
                                            <Clock size={16} />
                                            <span className="stat-value">
                                                {route.total_eta_hours.toFixed(1)}h
                                            </span>
                                            <span className="stat-label">ETA</span>
                                        </div>

                                        <div className="stat">
                                            <Truck size={16} />
                                            <span className="stat-value">{route.legs?.length || 1}</span>
                                            <span className="stat-label">Legs</span>
                                        </div>
                                    </div>

                                    {/* Route Legs */}
                                    <div className="route-legs">
                                        {route.legs?.map((leg, legIndex) => (
                                            <div key={legIndex} className="leg-item">
                                                <div className="leg-dot" style={{ background: getRouteColor(legIndex) }}></div>
                                                <div className="leg-info">
                                                    <span className="leg-distance">{leg.distance_km.toFixed(1)} km</span>
                                                    <span className="leg-cost">₹{parseFloat(leg.cost).toFixed(0)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-routes">
                            <AlertCircle size={48} />
                            <h3>No routes found</h3>
                            <p>Try adjusting your parameters or add more transporters</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
