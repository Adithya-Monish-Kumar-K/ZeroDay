"""Debug script to check vehicles in Supabase"""
import os
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

print(f"SUPABASE_URL: {SUPABASE_URL[:30]}..." if SUPABASE_URL else "SUPABASE_URL: NOT SET")
print(f"SUPABASE_KEY: {SUPABASE_KEY[:20]}..." if SUPABASE_KEY else "SUPABASE_KEY: NOT SET")

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch ALL vehicles (no filters)
print("\n=== ALL VEHICLES ===")
all_vehicles = client.table("vehicles").select("*").execute()
print(f"Total vehicles: {len(all_vehicles.data)}")
for v in all_vehicles.data:
    print(f"  - {v.get('plate_number')}: is_available={v.get('is_available')}, capacity={v.get('max_capacity_kg')}kg, lat={v.get('current_location_lat')}, lng={v.get('current_location_lng')}")

# Fetch available vehicles only
print("\n=== AVAILABLE VEHICLES (is_available=True) ===")
available_vehicles = client.table("vehicles").select("*").eq("is_available", True).execute()
print(f"Available vehicles: {len(available_vehicles.data)}")
for v in available_vehicles.data:
    print(f"  - {v.get('plate_number')}: capacity={v.get('max_capacity_kg')}kg, lat={v.get('current_location_lat')}")

# Fetch available with capacity >= 500
print("\n=== AVAILABLE VEHICLES with capacity >= 500kg ===")
cap_vehicles = client.table("vehicles").select("*").eq("is_available", True).gte("max_capacity_kg", 500).execute()
print(f"Matching vehicles: {len(cap_vehicles.data)}")
for v in cap_vehicles.data:
    print(f"  - {v.get('plate_number')}: capacity={v.get('max_capacity_kg')}kg, lat={v.get('current_location_lat')}")
