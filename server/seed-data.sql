-- ============================================
-- CHAINFREIGHT SEED DATA FOR SUPABASE
-- ============================================
-- Run this in Supabase SQL Editor
-- Make sure to create auth users first via Supabase Auth Dashboard
-- or use the auth.users insert (requires service_role key)

-- ============================================
-- STEP 1: Create Auth Users (run this first)
-- ============================================
-- NOTE: In Supabase, you typically create users via the Auth Dashboard
-- or API. These UUIDs should match users you create there.
-- For testing, you can create users with these emails:
--   - admin@chainfreight.com (password: Admin@123)
--   - shipper1@chainfreight.com (password: Shipper@123)
--   - shipper2@chainfreight.com (password: Shipper@123)
--   - transporter1@chainfreight.com (password: Transporter@123)
--   - transporter2@chainfreight.com (password: Transporter@123)

-- ============================================
-- STEP 2: Profiles (linked to auth.users)
-- ============================================
-- Use UUIDs that match the auth.users you created

INSERT INTO public.profiles (id, role, business_name, email, phone, verified) VALUES
-- Admin
('a0000000-0000-0000-0000-000000000001', 'admin', 'ChainFreight Admin', 'admin@chainfreight.com', '+91 9000000001', true),
-- Shippers
('b0000000-0000-0000-0000-000000000001', 'shipper', 'TechCorp Electronics', 'shipper1@chainfreight.com', '+91 9100000001', true),
('b0000000-0000-0000-0000-000000000002', 'shipper', 'FreshFarms Produce', 'shipper2@chainfreight.com', '+91 9100000002', true),
-- Transporters
('c0000000-0000-0000-0000-000000000001', 'transporter', 'SpeedyLogistics', 'transporter1@chainfreight.com', '+91 9200000001', true),
('c0000000-0000-0000-0000-000000000002', 'transporter', 'SafeHaul Transport', 'transporter2@chainfreight.com', '+91 9200000002', true);

-- ============================================
-- STEP 3: Vehicles
-- ============================================
INSERT INTO public.vehicles (id, transporter_id, plate_number, vehicle_type, max_capacity_kg, current_load_kg, base_rate_per_km, fuel_efficiency_km_l, current_location_lat, current_location_lng, home_base_location, is_available, capabilities) VALUES
-- SpeedyLogistics vehicles
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'TN01AB1234', 'covered', 10000, 0, 15.0, 8.5, 13.0827, 80.2707, 'Chennai, Tamil Nadu', true, ARRAY['gps_tracking', 'temperature_control']),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'TN01CD5678', 'open', 15000, 0, 12.0, 7.0, 13.0827, 80.2707, 'Chennai, Tamil Nadu', true, ARRAY['gps_tracking']),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'TN01EF9012', 'refrigerated', 8000, 0, 25.0, 6.5, 12.9716, 77.5946, 'Bangalore, Karnataka', true, ARRAY['gps_tracking', 'temperature_control', 'cold_chain']),
-- SafeHaul Transport vehicles
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'KA01MN3456', 'container', 20000, 0, 18.0, 6.0, 12.9716, 77.5946, 'Bangalore, Karnataka', true, ARRAY['gps_tracking', 'sealed_container']),
('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'KA01PQ7890', 'flatbed', 25000, 0, 20.0, 5.5, 17.3850, 78.4867, 'Hyderabad, Telangana', true, ARRAY['gps_tracking', 'heavy_load']),
('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'KA01RS1234', 'tanker', 18000, 0, 22.0, 5.0, 12.9716, 77.5946, 'Bangalore, Karnataka', false, ARRAY['gps_tracking', 'liquid_transport']);

-- ============================================
-- STEP 4: Shipments
-- ============================================
INSERT INTO public.shipments (id, shipper_id, cargo_type, weight_kg, quantity, special_requirements, origin_address, origin_lat, origin_lng, dest_address, dest_lat, dest_lng, pickup_deadline, delivery_deadline, status, total_price_estimate) VALUES
-- TechCorp Electronics shipments
('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'electronics', 2500, 50, ARRAY['fragile_handling', 'covered'], 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'Bangalore, Karnataka', 12.9716, 77.5946, NOW() + INTERVAL '2 days', NOW() + INTERVAL '4 days', 'posted', 45000),
('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'electronics', 1800, 30, ARRAY['fragile_handling'], 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'Hyderabad, Telangana', 17.3850, 78.4867, NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days', 'posted', 52000),
('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'electronics', 3200, 80, ARRAY['fragile_handling', 'insurance'], 'Bangalore, Karnataka', 12.9716, 77.5946, 'Mumbai, Maharashtra', 19.0760, 72.8777, NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 'assigned', 85000),
-- FreshFarms Produce shipments
('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'perishables', 5000, 200, ARRAY['refrigerated', 'urgent'], 'Coimbatore, Tamil Nadu', 11.0168, 76.9558, 'Chennai, Tamil Nadu', 13.0827, 80.2707, NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', 'posted', 28000),
('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'groceries', 8000, 500, ARRAY['dry_storage'], 'Madurai, Tamil Nadu', 9.9252, 78.1198, 'Bangalore, Karnataka', 12.9716, 77.5946, NOW() + INTERVAL '2 days', NOW() + INTERVAL '4 days', 'posted', 35000),
('e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'medicine', 500, 100, ARRAY['temperature_control', 'urgent', 'fragile_handling'], 'Chennai, Tamil Nadu', 13.0827, 80.2707, 'Trivandrum, Kerala', 8.5241, 76.9366, NOW() + INTERVAL '12 hours', NOW() + INTERVAL '1 day', 'in_transit', 42000),
-- Delivered shipments for history
('e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'general', 4000, 100, ARRAY[]::text[], 'Delhi, NCR', 28.6139, 77.2090, 'Mumbai, Maharashtra', 19.0760, 72.8777, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', 'delivered', 75000),
('e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002', 'perishables', 3000, 150, ARRAY['refrigerated'], 'Pune, Maharashtra', 18.5204, 73.8567, 'Bangalore, Karnataka', 12.9716, 77.5946, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', 'delivered', 32000);

-- ============================================
-- STEP 5: Route Legs (for assigned/in_transit shipments)
-- ============================================
INSERT INTO public.route_legs (id, shipment_id, vehicle_id, transporter_id, leg_sequence_index, is_last_leg, start_location_name, end_location_name, agreed_price, status) VALUES
-- Assigned shipment (e0000000...003) - Single leg
('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 1, true, 'Bangalore, Karnataka', 'Mumbai, Maharashtra', 80000, 'accepted'),
-- In-transit shipment (e0000000...006) - Two legs (relay)
('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 1, false, 'Chennai, Tamil Nadu', 'Madurai, Tamil Nadu', 18000, 'in_progress'),
('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 2, true, 'Madurai, Tamil Nadu', 'Trivandrum, Kerala', 20000, 'pending'),
-- Delivered shipments
('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 1, true, 'Delhi, NCR', 'Mumbai, Maharashtra', 70000, 'completed'),
('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 1, true, 'Pune, Maharashtra', 'Bangalore, Karnataka', 30000, 'completed');

-- ============================================
-- STEP 6: Checkpoints
-- ============================================
INSERT INTO public.checkpoints (id, route_leg_id, type, location_name, timestamp, image_proof_url, verified_by_user_id, notes) VALUES
-- In-transit shipment checkpoints
('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'pickup', 'Chennai Warehouse', NOW() - INTERVAL '6 hours', NULL, 'b0000000-0000-0000-0000-000000000002', 'Cargo loaded and sealed'),
('10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'intermediate', 'Villupuram Rest Stop', NOW() - INTERVAL '3 hours', NULL, NULL, 'Rest stop and fuel refill'),
-- Delivered shipment checkpoints
('10000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', 'pickup', 'Delhi Distribution Center', NOW() - INTERVAL '6 days', NULL, 'b0000000-0000-0000-0000-000000000001', 'Pickup completed'),
('10000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'intermediate', 'Jaipur Highway Stop', NOW() - INTERVAL '5 days', NULL, NULL, 'Driver rest'),
('10000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000004', 'delivery', 'Mumbai Warehouse', NOW() - INTERVAL '4 days', NULL, 'b0000000-0000-0000-0000-000000000001', 'Delivered successfully'),
('10000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000005', 'pickup', 'Pune Hub', NOW() - INTERVAL '4 days', NULL, 'b0000000-0000-0000-0000-000000000002', 'Goods in good condition'),
('10000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000005', 'delivery', 'Bangalore Cold Storage', NOW() - INTERVAL '2 days', NULL, 'b0000000-0000-0000-0000-000000000002', 'Temperature maintained throughout');

-- ============================================
-- STEP 7: Transporter Availability
-- ============================================
INSERT INTO public.transporter_availability (transporter_id, availability_radius_km, available_from, available_until, is_active) VALUES
('c0000000-0000-0000-0000-000000000001', 500, NOW(), NOW() + INTERVAL '30 days', true),
('c0000000-0000-0000-0000-000000000002', 800, NOW(), NOW() + INTERVAL '30 days', true);

-- ============================================
-- STEP 8: Transporter Pricing Rules
-- ============================================
INSERT INTO public.transporter_pricing_rules (id, transporter_id, vehicle_type, base_price, rate_per_km, urgency_multiplier_min, urgency_multiplier_max, is_active) VALUES
-- SpeedyLogistics pricing
('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'covered', 2000, 15.0, 1.0, 2.5, true),
('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'open', 1500, 12.0, 1.0, 2.0, true),
('20000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'refrigerated', 3500, 25.0, 1.2, 3.0, true),
-- SafeHaul Transport pricing
('20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'container', 4000, 18.0, 1.0, 2.5, true),
('20000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'flatbed', 3000, 20.0, 1.0, 2.0, true),
('20000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'tanker', 5000, 22.0, 1.2, 3.0, true);

-- ============================================
-- STEP 9: Notifications
-- ============================================
INSERT INTO public.notifications (id, user_id, title, message, related_shipment_id, is_read) VALUES
-- Shipper notifications
('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Shipment Assigned', 'Your shipment to Mumbai has been assigned to SafeHaul Transport', 'e0000000-0000-0000-0000-000000000003', false),
('30000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Shipment In Transit', 'Your medicine shipment is now in transit to Trivandrum', 'e0000000-0000-0000-0000-000000000006', true),
-- Transporter notifications
('30000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'New Job Available', 'A new refrigerated shipment is available near your location', NULL, false),
('30000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'Payment Received', 'Payment of ₹70,000 received for Delhi-Mumbai shipment', 'e0000000-0000-0000-0000-000000000007', true);

-- ============================================
-- STEP 10: Distance ETA Cache (sample routes)
-- ============================================
INSERT INTO public.distance_eta_cache (origin_lat, origin_lng, dest_lat, dest_lng, distance_km, eta_hours) VALUES
(13.0827, 80.2707, 12.9716, 77.5946, 350, 5.5),   -- Chennai to Bangalore
(13.0827, 80.2707, 17.3850, 78.4867, 625, 9.0),   -- Chennai to Hyderabad
(12.9716, 77.5946, 19.0760, 72.8777, 980, 14.0),  -- Bangalore to Mumbai
(28.6139, 77.2090, 19.0760, 72.8777, 1420, 20.0), -- Delhi to Mumbai
(11.0168, 76.9558, 13.0827, 80.2707, 505, 7.5),   -- Coimbatore to Chennai
(9.9252, 78.1198, 12.9716, 77.5946, 435, 7.0),    -- Madurai to Bangalore
(13.0827, 80.2707, 8.5241, 76.9366, 780, 12.0),   -- Chennai to Trivandrum
(18.5204, 73.8567, 12.9716, 77.5946, 840, 12.5);  -- Pune to Bangalore

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the seed data:

-- SELECT COUNT(*) as profiles_count FROM public.profiles;
-- SELECT COUNT(*) as vehicles_count FROM public.vehicles;
-- SELECT COUNT(*) as shipments_count FROM public.shipments;
-- SELECT COUNT(*) as route_legs_count FROM public.route_legs;
-- SELECT COUNT(*) as checkpoints_count FROM public.checkpoints;

-- View shipments with shipper info:
-- SELECT s.id, s.cargo_type, s.status, s.origin_address, s.dest_address, p.business_name as shipper
-- FROM public.shipments s
-- JOIN public.profiles p ON s.shipper_id = p.id;

-- View transporter vehicles:
-- SELECT v.plate_number, v.vehicle_type, v.max_capacity_kg, p.business_name as transporter
-- FROM public.vehicles v
-- JOIN public.profiles p ON v.transporter_id = p.id;

