export interface GlobeCity {
  name: string;
  lat: number;
  lng: number;
}

export const GLOBE_CITIES: GlobeCity[] = [
  // North America
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  { name: 'Atlanta', lat: 33.749, lng: -84.388 },
  { name: 'Dallas', lat: 32.7767, lng: -96.797 },

  // South America
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
  { name: 'Bogotá', lat: 4.711, lng: -74.0721 },
  { name: 'Lima', lat: -12.0464, lng: -77.0428 },
  { name: 'Santiago', lat: -33.4489, lng: -70.6693 },

  // Europe
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Zurich', lat: 47.3769, lng: 8.5417 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Frankfurt', lat: 50.1109, lng: 8.6821 },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
  { name: 'Lisbon', lat: 38.7223, lng: -9.1393 },

  // Africa
  { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
  { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  { name: 'Accra', lat: 5.6037, lng: -0.187 },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },

  // Middle East
  { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Tel Aviv', lat: 32.0853, lng: 34.7818 },
  { name: 'Riyadh', lat: 24.7136, lng: 46.6753 },
  { name: 'Doha', lat: 25.2854, lng: 51.531 },

  // Asia
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
  { name: 'Seoul', lat: 37.5665, lng: 126.978 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { name: 'Taipei', lat: 25.033, lng: 121.5654 },
  { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },

  // Oceania
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
  { name: 'Auckland', lat: -36.8485, lng: 174.7633 },
];

/** Pick a random city from the pool */
export function randomCity(): GlobeCity {
  return GLOBE_CITIES[Math.floor(Math.random() * GLOBE_CITIES.length)];
}

/** Pick two different random cities */
export function randomCityPair(): [GlobeCity, GlobeCity] {
  const from = randomCity();
  let to = randomCity();
  while (to.name === from.name) {
    to = randomCity();
  }
  return [from, to];
}
