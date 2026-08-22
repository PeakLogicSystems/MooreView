'use strict';

/**
 * Florida county centroids for Circle K fleet placement (planning / 3D map).
 * @type {Array<{ slug: string, name: string, lat: number, lng: number }>}
 */
const FLORIDA_COUNTIES = [
  { slug: 'alachua', name: 'Alachua', lat: 29.674, lng: -82.357 },
  { slug: 'baker', name: 'Baker', lat: 30.331, lng: -82.284 },
  { slug: 'bay', name: 'Bay', lat: 30.229, lng: -85.931 },
  { slug: 'brevard', name: 'Brevard', lat: 28.298, lng: -80.701 },
  { slug: 'broward', name: 'Broward', lat: 26.122, lng: -80.143 },
  { slug: 'charlotte', name: 'Charlotte', lat: 26.911, lng: -81.949 },
  { slug: 'citrus', name: 'Citrus', lat: 28.848, lng: -82.479 },
  { slug: 'clay', name: 'Clay', lat: 29.984, lng: -81.856 },
  { slug: 'collier', name: 'Collier', lat: 26.122, lng: -81.349 },
  { slug: 'columbia', name: 'Columbia', lat: 30.224, lng: -82.621 },
  { slug: 'duval', name: 'Duval', lat: 30.332, lng: -81.655 },
  { slug: 'escambia', name: 'Escambia', lat: 30.609, lng: -87.341 },
  { slug: 'flagler', name: 'Flagler', lat: 29.461, lng: -81.313 },
  { slug: 'hillsborough', name: 'Hillsborough', lat: 27.909, lng: -82.374 },
  { slug: 'indian-river', name: 'Indian River', lat: 27.694, lng: -80.606 },
  { slug: 'lake', name: 'Lake', lat: 28.761, lng: -81.711 },
  { slug: 'lee', name: 'Lee', lat: 26.554, lng: -81.949 },
  { slug: 'leon', name: 'Leon', lat: 30.458, lng: -84.277 },
  { slug: 'manatee', name: 'Manatee', lat: 27.479, lng: -82.345 },
  { slug: 'marion', name: 'Marion', lat: 29.187, lng: -82.054 },
  { slug: 'martin', name: 'Martin', lat: 27.051, lng: -80.190 },
  { slug: 'miami-dade', name: 'Miami-Dade', lat: 25.611, lng: -80.497 },
  { slug: 'monroe', name: 'Monroe', lat: 24.823, lng: -81.019 },
  { slug: 'nassau', name: 'Nassau', lat: 30.611, lng: -81.760 },
  { slug: 'okaloosa', name: 'Okaloosa', lat: 30.664, lng: -86.592 },
  { slug: 'orange', name: 'Orange', lat: 28.514, lng: -81.316 },
  { slug: 'osceola', name: 'Osceola', lat: 28.044, lng: -81.143 },
  { slug: 'palm-beach', name: 'Palm Beach', lat: 26.647, lng: -80.465 },
  { slug: 'pasco', name: 'Pasco', lat: 28.307, lng: -82.416 },
  { slug: 'pinellas', name: 'Pinellas', lat: 27.921, lng: -82.725 },
  { slug: 'polk', name: 'Polk', lat: 27.948, lng: -81.843 },
  { slug: 'putnam', name: 'Putnam', lat: 29.609, lng: -81.778 },
  { slug: 'santa-rosa', name: 'Santa Rosa', lat: 30.632, lng: -87.021 },
  { slug: 'sarasota', name: 'Sarasota', lat: 27.201, lng: -82.351 },
  { slug: 'seminole', name: 'Seminole', lat: 28.716, lng: -81.236 },
  { slug: 'st-johns', name: 'St. Johns', lat: 29.901, lng: -81.414 },
  { slug: 'st-lucie', name: 'St. Lucie', lat: 27.377, lng: -80.358 },
  { slug: 'sumter', name: 'Sumter', lat: 28.717, lng: -82.077 },
  { slug: 'volusia', name: 'Volusia', lat: 29.058, lng: -81.229 },
  { slug: 'walton', name: 'Walton', lat: 30.611, lng: -86.169 },
];

module.exports = { FLORIDA_COUNTIES };
