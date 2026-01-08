import express from 'express';
import { supabase } from '../config/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Status enum matching database schema
const SHIPMENT_STATUSES = ['posted', 'processing', 'assigned', 'in_transit', 'delivered', 'cancelled'];

// Cargo types for categorization
const CARGO_TYPES = ['general', 'electronics', 'perishables', 'medicine', 'groceries', 'fragile', 'hazardous', 'livestock', 'heavy_machinery'];

// Mock shipments for development
let mockShipments = [
    {
        id: '1',
        shipper_id: '2',
        cargo_type: 'electronics',
        weight_kg: 500,
        quantity: 10,
        special_requirements: ['covered', 'fragile_handling'],
        origin_address: 'Chennai, Tamil Nadu',
        origin_lat: 13.0827,
        origin_lng: 80.2707,
        dest_address: 'Bangalore, Karnataka',
        dest_lat: 12.9716,
        dest_lng: 77.5946,
        pickup_deadline: new Date(Date.now() + 86400000).toISOString(),
        delivery_deadline: new Date(Date.now() + 172800000).toISOString(),
        status: 'posted',
        total_price_estimate: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

// Get all shipments (filtered by role)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { status, cargo_type, from_date, to_date } = req.query;

        if (supabase) {
            let query = supabase
                .from('shipments')
                .select(`
                    *,
                    shipper:profiles!shipper_id(id, business_name, phone, email)
                `);

            // Filter by user role - shippers see their own, transporters see ones they're assigned to
            if (req.user.role === 'shipper') {
                query = query.eq('shipper_id', req.user.id);
            } else if (req.user.role === 'transporter') {
                // Transporters see shipments where they are assigned (via route_legs or transporter_id)
                // First, get shipment IDs from route_legs where this transporter is assigned
                const { data: routeLegs } = await supabase
                    .from('route_legs')
                    .select('shipment_id')
                    .eq('transporter_id', req.user.id);
                
                const assignedShipmentIds = routeLegs?.map(rl => rl.shipment_id) || [];
                
                if (assignedShipmentIds.length > 0) {
                    query = query.in('id', assignedShipmentIds);
                } else {
                    // No assigned shipments, return empty
                    return res.json([]);
                }
            }

            if (status) query = query.eq('status', status);
            if (cargo_type) query = query.eq('cargo_type', cargo_type);
            if (from_date) query = query.gte('pickup_deadline', from_date);
            if (to_date) query = query.lte('pickup_deadline', to_date);

            const { data: shipments, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            res.json(shipments);
        } else {
            let shipments = [...mockShipments];
            if (req.user.role === 'shipper') {
                shipments = shipments.filter(s => s.shipper_id === req.user.id);
            } else if (req.user.role === 'transporter') {
                shipments = shipments.filter(s => s.status === 'posted');
            }
            if (status) shipments = shipments.filter(s => s.status === status);
            if (cargo_type) shipments = shipments.filter(s => s.cargo_type === cargo_type);
            res.json(shipments);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available shipments for transporters (posted only - marketplace)
router.get('/available', verifyToken, requireRole('transporter'), async (req, res) => {
    try {
        const { cargo_type, min_weight, max_weight, origin_lat, origin_lng, radius_km } = req.query;

        if (supabase) {
            let query = supabase
                .from('shipments')
                .select(`
                    *,
                    shipper:profiles!shipper_id(id, business_name, phone, verified)
                `)
                .eq('status', 'posted');

            if (cargo_type) query = query.eq('cargo_type', cargo_type);
            if (min_weight) query = query.gte('weight_kg', parseInt(min_weight));
            if (max_weight) query = query.lte('weight_kg', parseInt(max_weight));

            const { data: shipments, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            // Filter by radius if origin provided
            let filteredShipments = shipments;
            if (origin_lat && origin_lng && radius_km) {
                filteredShipments = shipments.filter(s => {
                    const distance = calculateDistance(
                        parseFloat(origin_lat), parseFloat(origin_lng),
                        s.origin_lat, s.origin_lng
                    );
                    return distance <= parseFloat(radius_km);
                });
            }

            res.json(filteredShipments);
        } else {
            let shipments = mockShipments.filter(s => s.status === 'posted');
            if (cargo_type) shipments = shipments.filter(s => s.cargo_type === cargo_type);
            if (min_weight) shipments = shipments.filter(s => s.weight_kg >= parseInt(min_weight));
            if (max_weight) shipments = shipments.filter(s => s.weight_kg <= parseInt(max_weight));
            res.json(shipments);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single shipment with route legs
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (supabase) {
            const { data: shipment, error } = await supabase
                .from('shipments')
                .select(`
                    *,
                    shipper:profiles!shipper_id(id, business_name, phone, email),
                    route_legs(
                        *,
                        vehicle:vehicles(id, plate_number, vehicle_type),
                        transporter:profiles!transporter_id(id, business_name, phone)
                    )
                `)
                .eq('id', id)
                .limit(1);

            if (error) throw error;
            
            if (!shipment || shipment.length === 0) {
                return res.status(404).json({ error: 'Shipment not found' });
            }
            
            res.json(shipment[0]);
        } else {
            const shipment = mockShipments.find(s => s.id === id);
            if (!shipment) {
                return res.status(404).json({ error: 'Shipment not found' });
            }
            res.json({ ...shipment, route_legs: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new shipment (shipper only)
router.post('/', verifyToken, requireRole('shipper'), async (req, res) => {
    try {
        const {
            cargo_type,
            weight_kg,
            quantity,
            special_requirements,
            origin_address,
            origin_lat,
            origin_lng,
            dest_address,
            dest_lat,
            dest_lng,
            pickup_deadline,
            delivery_deadline,
            total_price_estimate
        } = req.body;

        // Validation
        if (!cargo_type || !weight_kg || !origin_address || !origin_lat || !origin_lng ||
            !dest_address || !dest_lat || !dest_lng) {
            return res.status(400).json({
                error: 'Required fields: cargo_type, weight_kg, origin (address, lat, lng), destination (address, lat, lng)'
            });
        }

        if (weight_kg <= 0) {
            return res.status(400).json({ error: 'Weight must be greater than 0' });
        }

        const shipmentData = {
            id: crypto.randomUUID(),
            shipper_id: req.user.id,
            cargo_type,
            weight_kg: parseInt(weight_kg),
            quantity: parseInt(quantity) || 1,
            special_requirements: special_requirements || [],
            origin_address,
            origin_lat: parseFloat(origin_lat),
            origin_lng: parseFloat(origin_lng),
            dest_address,
            dest_lat: parseFloat(dest_lat),
            dest_lng: parseFloat(dest_lng),
            pickup_deadline: pickup_deadline || null,
            delivery_deadline: delivery_deadline || null,
            status: 'posted',
            total_price_estimate: total_price_estimate ? parseFloat(total_price_estimate) : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (supabase) {
            const { data: shipment, error } = await supabase
                .from('shipments')
                .insert([shipmentData])
                .select()
                .single();

            if (error) throw error;
            res.status(201).json(shipment);
        } else {
            mockShipments.push(shipmentData);
            res.status(201).json(shipmentData);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update shipment (shipper can update their own)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            cargo_type,
            weight_kg,
            quantity,
            special_requirements,
            origin_address,
            origin_lat,
            origin_lng,
            dest_address,
            dest_lat,
            dest_lng,
            pickup_deadline,
            delivery_deadline,
            total_price_estimate
        } = req.body;

        const updateData = {
            ...(cargo_type && { cargo_type }),
            ...(weight_kg !== undefined && { weight_kg: parseInt(weight_kg) }),
            ...(quantity !== undefined && { quantity: parseInt(quantity) }),
            ...(special_requirements && { special_requirements }),
            ...(origin_address && { origin_address }),
            ...(origin_lat !== undefined && { origin_lat: parseFloat(origin_lat) }),
            ...(origin_lng !== undefined && { origin_lng: parseFloat(origin_lng) }),
            ...(dest_address && { dest_address }),
            ...(dest_lat !== undefined && { dest_lat: parseFloat(dest_lat) }),
            ...(dest_lng !== undefined && { dest_lng: parseFloat(dest_lng) }),
            ...(pickup_deadline !== undefined && { pickup_deadline }),
            ...(delivery_deadline !== undefined && { delivery_deadline }),
            ...(total_price_estimate !== undefined && { total_price_estimate: parseFloat(total_price_estimate) }),
            updated_at: new Date().toISOString()
        };

        if (supabase) {
            const { data: shipment, error } = await supabase
                .from('shipments')
                .update(updateData)
                .eq('id', id)
                .eq('shipper_id', req.user.id) // Only owner can update
                .select()
                .single();

            if (error) throw error;
            res.json(shipment);
        } else {
            const index = mockShipments.findIndex(s => s.id === id && s.shipper_id === req.user.id);
            if (index === -1) {
                return res.status(404).json({ error: 'Shipment not found' });
            }
            mockShipments[index] = { ...mockShipments[index], ...updateData };
            res.json(mockShipments[index]);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update shipment status
router.put('/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!SHIPMENT_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${SHIPMENT_STATUSES.join(', ')}` });
        }

        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };

        if (supabase) {
            const { data: shipment, error } = await supabase
                .from('shipments')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    shipper:profiles!shipper_id(email, business_name)
                `)
                .single();

            if (error) throw error;
            res.json(shipment);
        } else {
            const index = mockShipments.findIndex(s => s.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Shipment not found' });
            }
            mockShipments[index] = { ...mockShipments[index], ...updateData };
            res.json(mockShipments[index]);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel shipment (shipper only, only if still posted)
router.post('/:id/cancel', verifyToken, requireRole('shipper'), async (req, res) => {
    try {
        const { id } = req.params;

        if (supabase) {
            // Check current status
            const { data: existing } = await supabase
                .from('shipments')
                .select('status')
                .eq('id', id)
                .eq('shipper_id', req.user.id)
                .single();

            if (!existing) {
                return res.status(404).json({ error: 'Shipment not found' });
            }

            if (existing.status !== 'posted') {
                return res.status(400).json({ error: 'Can only cancel shipments with status "posted"' });
            }

            const { data: shipment, error } = await supabase
                .from('shipments')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            res.json(shipment);
        } else {
            const index = mockShipments.findIndex(s => s.id === id && s.shipper_id === req.user.id);
            if (index === -1) {
                return res.status(404).json({ error: 'Shipment not found' });
            }
            if (mockShipments[index].status !== 'posted') {
                return res.status(400).json({ error: 'Can only cancel shipments with status "posted"' });
            }
            mockShipments[index].status = 'cancelled';
            mockShipments[index].updated_at = new Date().toISOString();
            res.json(mockShipments[index]);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Accept shipment (transporter only)
router.post('/:id/accept', verifyToken, requireRole('transporter'), async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicle_id, proposed_price } = req.body;

        if (!vehicle_id) {
            return res.status(400).json({ error: 'Vehicle ID is required' });
        }

        if (supabase) {
            // Check if shipment exists and is available
            const { data: shipment, error: shipmentError } = await supabase
                .from('shipments')
                .select('*')
                .eq('id', id)
                .eq('status', 'posted')
                .single();

            if (shipmentError || !shipment) {
                return res.status(404).json({ error: 'Shipment not found or already assigned' });
            }

            // Verify vehicle belongs to this transporter
            const { data: vehicle, error: vehicleError } = await supabase
                .from('vehicles')
                .select('*')
                .eq('id', vehicle_id)
                .eq('transporter_id', req.user.id)
                .single();

            if (vehicleError || !vehicle) {
                return res.status(400).json({ error: 'Invalid vehicle or not owned by you' });
            }

            // Create route_leg
            const routeLegData = {
                shipment_id: id,
                vehicle_id: vehicle_id,
                transporter_id: req.user.id,
                leg_sequence_index: 1,
                is_last_leg: true,
                start_location_name: shipment.origin_address,
                end_location_name: shipment.dest_address,
                agreed_price: proposed_price || shipment.total_price_estimate,
                status: 'accepted'
            };

            const { data: routeLeg, error: routeLegError } = await supabase
                .from('route_legs')
                .insert([routeLegData])
                .select()
                .single();

            if (routeLegError) throw routeLegError;

            // Update shipment status to assigned
            const { data: updatedShipment, error: updateError } = await supabase
                .from('shipments')
                .update({ status: 'assigned', updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;

            res.json({
                message: 'Shipment accepted successfully',
                shipment: updatedShipment,
                route_leg: routeLeg
            });
        } else {
            // Mock implementation
            const shipmentIndex = mockShipments.findIndex(s => s.id === id && s.status === 'posted');
            if (shipmentIndex === -1) {
                return res.status(404).json({ error: 'Shipment not found or already assigned' });
            }

            mockShipments[shipmentIndex].status = 'assigned';
            mockShipments[shipmentIndex].updated_at = new Date().toISOString();

            res.json({
                message: 'Shipment accepted successfully',
                shipment: mockShipments[shipmentIndex]
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get cargo types
router.get('/types/cargo', (req, res) => {
    res.json(CARGO_TYPES);
});

// Get shipment statuses
router.get('/types/statuses', (req, res) => {
    res.json(SHIPMENT_STATUSES);
});

// Helper: Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

export default router;
