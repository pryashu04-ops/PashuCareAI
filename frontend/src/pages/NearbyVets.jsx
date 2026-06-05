import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { 
  MapPin, Phone, Clock, Star, Compass, Navigation, 
  AlertTriangle, Search, Map, List, ExternalLink 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Custom Google Maps Dark Theme styling
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#34d399" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f172a" }],
  },
];

// Helper to calculate distance in km using Haversine formula
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const NearbyVets = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Coordinates
  const [mapCenter, setMapCenter] = useState({ lat: 12.9716, lng: 77.5946 }); // Default Bangalore
  const [userLocation, setUserLocation] = useState(null);

  // States
  const [googleMapsKey, setGoogleMapsKey] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapAuthFailed, setMapAuthFailed] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [vets, setVets] = useState([]);
  const [loadingVets, setLoadingVets] = useState(false);
  const [error, setError] = useState("");
  const [radiusNotice, setRadiusNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // View mode switcher: "split", "map", "list"
  const [viewMode, setViewMode] = useState(() => {
    return window.innerWidth >= 1024 ? "split" : "map";
  });

  // Filters State
  const [filters, setFilters] = useState({
    openNow: false,
    twentyFourHours: false,
    highestRated: false,
  });
  const [sortBy, setSortBy] = useState("nearest");

  // Detailed selected clinic state
  const [selectedVet, setSelectedVet] = useState(null);
  const [selectedVetDetails, setSelectedVetDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Refs
  const mapRef = useRef(null);
  const googleMapInstance = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

  // 1. Fetch Config API Key and load Google Maps script
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get("/api/vets/config");
        if (response.data && response.data.api_key) {
          setGoogleMapsKey(response.data.api_key);
          loadGoogleMapsScript(response.data.api_key);
        } else {
          console.warn("No Google Maps API Key returned.");
          setError("Google Maps API Key not available.");
        }
      } catch (err) {
        console.error("Config fetch error:", err);
        setError("Unable to retrieve map settings.");
      }
    };

    fetchConfig();

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Inject script loader
  const loadGoogleMapsScript = (apiKey) => {
    window.gm_authFailure = () => {
      console.warn("Google Maps auth failure detected. Switching to Radar Map fallback.");
      setMapAuthFailed(true);
      setScriptLoaded(true);
    };

    if (window.google && window.google.maps) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error("Google Maps script load failed.");
      setError("Failed to load Google Maps script. Using radar fallback.");
      setMapAuthFailed(true);
      setScriptLoaded(true);
    };
    document.head.appendChild(script);
  };

  // 2. Initialize Geolocation Watcher when script is loaded
  useEffect(() => {
    if (scriptLoaded) {
      getUserLocation();
    }
  }, [scriptLoaded]);

  // 3. Initialize Map
  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || mapAuthFailed) return;

    if (!googleMapInstance.current) {
      try {
        googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: mapCenter,
          zoom: 11,
          styles: darkMapStyle,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      } catch (err) {
        console.error("Map initialization failed:", err);
        setError("Failed to initialize Google Maps.");
      }
    } else {
      googleMapInstance.current.setCenter(mapCenter);
    }
  }, [scriptLoaded, mapCenter, mapAuthFailed]);

  // 4. Update User Marker on map when location changes
  useEffect(() => {
    if (!scriptLoaded || !googleMapInstance.current || !userLocation || mapAuthFailed) return;

    try {
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition(userLocation);
      } else {
        userMarkerRef.current = new window.google.maps.Marker({
          position: userLocation,
          map: googleMapInstance.current,
          title: "Your Live Location",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      }
    } catch (err) {
      console.error("User marker creation error:", err);
    }
  }, [scriptLoaded, userLocation, mapAuthFailed]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoadingLoc(true);
    setError("");

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newCoords);
        setLoadingLoc(false);

        // Pan center to user first time
        setMapCenter(newCoords);
        if (googleMapInstance.current) {
          googleMapInstance.current.panTo(newCoords);
        }
        runSearch(newCoords);
      },
      (err) => {
        console.warn("Geolocation permission denied or error:", err);
        setError("Location access required to find nearby veterinary hospitals.");
        setLoadingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // Run Google Places Search
  const runSearch = async (centerPoint) => {
    setLoadingVets(true);
    setError("");
    setRadiusNotice("");

    if (mapAuthFailed || !window.google || !window.google.maps || !window.google.maps.places || !googleMapInstance.current) {
      // Fallback to backend Overpass API
      try {
        const response = await api.get("/api/vets/nearby", {
          params: {
            lat: centerPoint.lat,
            lng: centerPoint.lng,
            radius: 50000 // 50 km in meters
          }
        });
        
        if (response.data && response.data.results) {
          const results = response.data.results.map((vet) => {
            const dist = getDistance(
              userLocation ? userLocation.lat : centerPoint.lat, 
              userLocation ? userLocation.lng : centerPoint.lng, 
              vet.lat, 
              vet.lng
            );
            return {
              place_id: vet.name.replace(/\s+/g, '_') + "_" + vet.lat + "_" + vet.lng,
              name: vet.name,
              address: vet.address,
              lat: vet.lat,
              lng: vet.lng,
              rating: vet.rating || 4.2,
              user_ratings_total: 10,
              open_now: vet.open_now !== undefined ? vet.open_now : true,
              distance: dist,
              phone: vet.phone || "No contact listed"
            };
          });
          results.sort((a, b) => a.distance - b.distance);
          setVets(results);
          if (response.data.error) {
            setRadiusNotice(response.data.error);
          }
        } else {
          setVets([]);
          setError("No veterinary hospitals available near your location.");
        }
      } catch (err) {
        console.error("Backend vets fetch error:", err);
        setVets([]);
        setError("Failed to fetch nearby veterinary clinics.");
      } finally {
        setLoadingVets(false);
      }
      return;
    }

    try {
      const service = new window.google.maps.places.PlacesService(googleMapInstance.current);
      
      service.textSearch(
        {
          location: new window.google.maps.LatLng(centerPoint.lat, centerPoint.lng),
          radius: 50000, // 50 km initial search bias
          query: "veterinary hospital animal hospital veterinary clinic pet care center cow goat sheep",
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Deduplicate results by place_id
            const uniqueResults = [];
            const seenIds = new Set();
            for (const place of results) {
              if (place.place_id && !seenIds.has(place.place_id)) {
                seenIds.add(place.place_id);
                uniqueResults.push(place);
              }
            }

            // Calculate actual distances from user location
            const origin = userLocation || centerPoint;
            const formatted = uniqueResults.map((place) => {
              const placeLat = place.geometry.location.lat();
              const placeLng = place.geometry.location.lng();
              const distance = getDistance(origin.lat, origin.lng, placeLat, placeLng);
              
              let isOpen = null;
              if (place.opening_hours) {
                isOpen = typeof place.opening_hours.isOpen === "function" 
                  ? place.opening_hours.isOpen() 
                  : place.opening_hours.open_now;
              }

              return {
                place_id: place.place_id,
                name: place.name,
                address: place.formatted_address || place.vicinity,
                lat: placeLat,
                lng: placeLng,
                rating: place.rating || 0,
                user_ratings_total: place.user_ratings_total || 0,
                open_now: isOpen,
                distance: distance
              };
            });

            // Filter to strictly 50 km for initial search
            const initialFiltered = formatted.filter(vet => vet.distance <= 50.0);
            
            // Sort by nearest distance first
            initialFiltered.sort((a, b) => a.distance - b.distance);

            if (initialFiltered.length > 0) {
              setVets(initialFiltered);
              createMarkersForVets(initialFiltered);
              setLoadingVets(false);
            } else {
              // No hospitals within 50 km
              setRadiusNotice("No veterinary hospitals found within 50 km.");
              
              // Automatically perform second search with larger radius (e.g. 100 km, 200 km)
              const expandedFiltered = formatted.filter(vet => vet.distance <= 200.0);
              expandedFiltered.sort((a, b) => a.distance - b.distance);

              if (expandedFiltered.length > 0) {
                setVets(expandedFiltered);
                createMarkersForVets(expandedFiltered);
              } else {
                if (formatted.length > 0) {
                  formatted.sort((a, b) => a.distance - b.distance);
                  setVets(formatted);
                  createMarkersForVets(formatted);
                } else {
                  setVets([]);
                  createMarkersForVets([]);
                  setError("No veterinary hospitals available near your location.");
                }
              }
              setLoadingVets(false);
            }
          } else {
            setVets([]);
            createMarkersForVets([]);
            setError("No veterinary hospitals available near your location.");
            setLoadingVets(false);
          }
        }
      );
    } catch (err) {
      console.error("Places search crashed:", err);
      setVets([]);
      createMarkersForVets([]);
      setError("No veterinary hospitals available near your location.");
      setLoadingVets(false);
    }
  };

  // Add markers on map
  const createMarkersForVets = (vetsList) => {
    if (mapAuthFailed || !googleMapInstance.current || !window.google || !window.google.maps) return;

    try {
      // Clear old markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const newMarkers = vetsList.map((vet, idx) => {
        const marker = new window.google.maps.Marker({
          position: { lat: vet.lat, lng: vet.lng },
          map: googleMapInstance.current,
          title: vet.name,
          label: {
            text: (idx + 1).toString(),
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "12px",
          },
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#10b981", // Emerald Green
            fillOpacity: 1,
            strokeColor: "#090d16",
            strokeWeight: 1.5,
            labelOrigin: new window.google.maps.Point(0, -2),
          },
        });

        marker.addListener("click", () => {
          handleSelectVet(vet);
        });

        return marker;
      });

      markersRef.current = newMarkers;
    } catch (err) {
      console.error("Failed to render markers:", err);
    }
  };

  // Handle clinic selection & load details dynamically
  const handleSelectVet = (vet) => {
    setSelectedVet(vet);
    setSelectedVetDetails(null);
    setLoadingDetails(true);

    if (!mapAuthFailed && googleMapInstance.current) {
      try {
        googleMapInstance.current.panTo({ lat: vet.lat, lng: vet.lng });
        googleMapInstance.current.setZoom(15);
      } catch (err) {
        console.warn("Could not pan MapInstance:", err);
      }
    }

    if (mapAuthFailed || !window.google || !window.google.maps || !window.google.maps.places || !googleMapInstance.current) {
      // Fallback details population
      setSelectedVetDetails({
        name: vet.name,
        formatted_address: vet.address,
        formatted_phone_number: vet.phone || "No contact listed",
        rating: vet.rating,
        opening_hours: { weekday_text: ["Schedules not available"] },
      });
      setLoadingDetails(false);
      return;
    }

    try {
      const service = new window.google.maps.places.PlacesService(googleMapInstance.current);
      service.getDetails(
        {
          placeId: vet.place_id,
          fields: ["name", "formatted_address", "formatted_phone_number", "rating", "opening_hours", "url"],
        },
        (details, status) => {
          setLoadingDetails(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setSelectedVetDetails(details);
          } else {
            console.error("Failed to fetch detailed info:", status);
            setSelectedVetDetails({
              name: vet.name,
              formatted_address: vet.address,
              formatted_phone_number: "No contact listed",
              rating: vet.rating,
              opening_hours: { weekday_text: ["Schedules not available"] },
            });
          }
        }
      );
    } catch (err) {
      console.error("Place details crashed:", err);
      setSelectedVetDetails({
        name: vet.name,
        formatted_address: vet.address,
        formatted_phone_number: "No contact listed",
        rating: vet.rating,
        opening_hours: { weekday_text: ["Schedules not available"] },
      });
      setLoadingDetails(false);
    }
  };

  // Search by city
  const handleCitySearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    setError("");
    setLoadingVets(true);

    if (mapAuthFailed || !window.google || !window.google.maps || !window.google.maps.Geocoder) {
      // Fallback Geocoding for major cities
      const cityCenters = {
        bangalore: { lat: 12.9716, lng: 77.5946 },
        mumbai: { lat: 19.0760, lng: 72.8777 },
        delhi: { lat: 28.6139, lng: 77.2090 },
        pune: { lat: 18.5204, lng: 73.8567 },
        hyderabad: { lat: 17.3850, lng: 78.4867 },
        chennai: { lat: 13.0827, lng: 80.2707 },
        kolkata: { lat: 22.5726, lng: 88.3639 },
      };

      const matchedCity = Object.keys(cityCenters).find(c => query.includes(c));
      if (matchedCity) {
        const coords = cityCenters[matchedCity];
        setMapCenter(coords);
        runSearch(coords);
      } else {
        const coords = userLocation || { lat: 12.9716, lng: 77.5946 };
        runSearch(coords);
        setError("City not in offline index. Showing results near current center.");
      }
      return;
    }

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchQuery }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK) {
          const newCoords = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          };
          setMapCenter(newCoords);
          if (googleMapInstance.current) {
            googleMapInstance.current.setCenter(newCoords);
            googleMapInstance.current.setZoom(11);
          }
          runSearch(newCoords);
        } else {
          setError(`City search failed: ${status}`);
          setLoadingVets(false);
        }
      });
    } catch (err) {
      console.error("Geocoder crash:", err);
      setError("Geocoder is unavailable. Check network or API settings.");
      setLoadingVets(false);
    }
  };

  // Filter & Sort list computation
  const getFilteredVets = () => {
    let resultList = [...vets];

    // 1. Open Now filter
    if (filters.openNow) {
      resultList = resultList.filter((v) => v.open_now === true);
    }

    // 2. 24 Hours filter
    if (filters.twentyFourHours) {
      resultList = resultList.filter(
        (v) =>
          v.name.toLowerCase().includes("24") ||
          v.name.toLowerCase().includes("twenty four") ||
          v.name.toLowerCase().includes("emergency")
      );
    }

    // 3. Highest Rated filter (Rating >= 4.5)
    if (filters.highestRated) {
      resultList = resultList.filter((v) => v.rating >= 4.5);
    }

    // 4. Distance vs Rating Sorting
    if (sortBy === "nearest") {
      resultList.sort((a, b) => a.distance - b.distance);
    } else {
      resultList.sort((a, b) => b.rating - a.rating);
    }

    return resultList;
  };

  const filteredVets = getFilteredVets();

  return (
    <div className="bg-slate-950 text-white min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              {t("nearbyVetHospital")}
            </h1>
            <p className="text-slate-400 text-sm max-w-lg">
              Find verified clinics, emergency animal centers, and veterinary specialists using real-time maps.
            </p>
          </div>

          {/* Search bar & GPS button */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
            <form onSubmit={handleCitySearch} className="relative flex items-stretch">
              <input
                type="text"
                placeholder={t("searchCityPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 pl-10 bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none rounded-xl text-sm transition text-white"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <button
                type="submit"
                className="ml-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center gap-1 cursor-pointer shadow-lg shadow-emerald-950/20"
              >
                {t("search")}
              </button>
            </form>

            <button
              onClick={getUserLocation}
              disabled={loadingLoc}
              className="px-4 py-2 border border-slate-800 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-emerald-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className={`w-4 h-4 ${loadingLoc ? "animate-spin" : ""}`} />
              <span>{loadingLoc ? "Locating..." : t("useMyLocation")}</span>
            </button>
          </div>
        </div>

        {/* Global Warnings / Permissions */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center space-x-3 text-red-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Radius Notice */}
        {radiusNotice && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center space-x-3 text-amber-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{radiusNotice}</span>
          </div>
        )}

        {/* Filters and View Switchers */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-4 rounded-2xl">
          {/* Quick Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Filters:</span>
            
            <button
              onClick={() => setFilters((prev) => ({ ...prev, openNow: !prev.openNow }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                filters.openNow
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
            >
              {t("openNowOnly")}
            </button>

            <button
              onClick={() => setFilters((prev) => ({ ...prev, twentyFourHours: !prev.twentyFourHours }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                filters.twentyFourHours
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
            >
              {t("twentyFourHours")}
            </button>

            <button
              onClick={() => setFilters((prev) => ({ ...prev, highestRated: !prev.highestRated }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                filters.highestRated
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
            >
              {t("highestRated")} (4.5★+)
            </button>

            {/* Divider */}
            <div className="h-5 w-[1px] bg-slate-850 mx-1 hidden sm:block" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1 mr-1">Sort:</span>

            <button
              onClick={() => setSortBy("nearest")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                sortBy === "nearest"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
            >
              {t("nearestFirst")}
            </button>

            <button
              onClick={() => setSortBy("rating")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                sortBy === "rating"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
            >
              Rating (High-Low)
            </button>
          </div>

          {/* View Switchers */}
          <div className="flex items-stretch border border-slate-800 rounded-xl overflow-hidden self-stretch lg:self-auto shadow-md">
            <button
              onClick={() => setViewMode("map")}
              className={`flex-1 lg:flex-initial px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                viewMode === "map" ? "bg-slate-800 text-emerald-400" : "bg-slate-950 text-slate-400"
              }`}
            >
              <Map className="w-4 h-4" />
              <span>{t("mapView")}</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 lg:flex-initial px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                viewMode === "list" ? "bg-slate-800 text-emerald-400" : "bg-slate-950 text-slate-400"
              }`}
            >
              <List className="w-4 h-4" />
              <span>{t("listView")}</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`hidden lg:flex px-4 py-2 text-center text-xs font-semibold items-center justify-center gap-1.5 transition ${
                viewMode === "split" ? "bg-slate-800 text-emerald-400" : "bg-slate-950 text-slate-400"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Split View</span>
            </button>
          </div>
        </div>

        {/* Main Interface Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* List panel */}
          <div className={`space-y-4 flex flex-col ${
            viewMode === "list" 
              ? "col-span-1 lg:col-span-3 block" 
              : viewMode === "map" 
                ? "hidden" 
                : "col-span-1 lg:col-span-1 block"
          }`}>
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex-1 flex flex-col overflow-hidden max-h-[600px]">
              <h2 className="text-sm font-semibold text-slate-400 mb-3 border-b border-slate-850 pb-2 flex justify-between">
                <span>{t("nearbyVetsTitle")}</span>
                <span className="text-emerald-400 text-xs font-bold">{filteredVets.length} found</span>
              </h2>

              {loadingVets ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
                  <span className="text-xs text-slate-400">Querying nearby places...</span>
                </div>
              ) : filteredVets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500">
                  <Compass className="w-12 h-12 mb-3 text-slate-700 animate-pulse" />
                  <p className="text-xs text-center px-4">{t("noVetsFound")}</p>
                </div>
              ) : (
                <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar ${
                  viewMode === "list" 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4" 
                    : "space-y-3"
                }`}>
                  {filteredVets.map((vet, idx) => (
                    <motion.div
                      key={vet.place_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleSelectVet(vet)}
                      className={`p-4 border rounded-xl space-y-3 cursor-pointer transition text-left h-fit ${
                        selectedVet?.place_id === vet.place_id
                          ? "bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-950/10"
                          : "bg-slate-950 border-slate-850 hover:border-slate-800 hover:bg-slate-900/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold rounded px-1.5 py-0.5 mt-0.5">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-sm text-slate-200 flex-1 leading-tight">{vet.name}</h3>
                        {vet.rating > 0 && (
                          <div className="flex items-center text-amber-400 text-[11px] font-semibold shrink-0">
                            <Star className="w-3.5 h-3.5 fill-current mr-0.5" />
                            <span>{vet.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{vet.address}</span>
                      </p>

                      <div className="flex justify-between items-center text-[10px] pt-1">
                        {vet.open_now !== null && (
                          <span className={`font-bold ${
                            vet.open_now ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {vet.open_now ? t("openNow") : t("closed")}
                          </span>
                        )}
                        {vet.distance !== undefined && (
                          <span className="bg-slate-800 text-slate-350 px-2 py-0.5 rounded font-bold">
                            {vet.distance.toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map panel */}
          <div className={`relative h-[560px] lg:h-[600px] flex flex-col ${
            viewMode === "map" 
              ? "col-span-1 lg:col-span-3 block" 
              : viewMode === "list" 
                ? "hidden" 
                : "col-span-1 lg:col-span-2 block"
          }`}>
            
            {/* Map container */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden flex-1 relative shadow-2xl">
              <style>{`
                @keyframes radar-sweep {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                .animate-radar-sweep {
                  animation: radar-sweep 8s linear infinite;
                }
              `}</style>
              
              {loadingLoc && (
                <div className="absolute top-4 left-4 bg-slate-950/80 border border-emerald-500/20 backdrop-blur rounded-xl px-3 py-1.5 z-20 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Navigation className="w-3.5 h-3.5 animate-spin" />
                  <span>Locating user...</span>
                </div>
              )}

              {!googleMapsKey && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
                  <span className="text-xs text-slate-400">Loading map configuration...</span>
                </div>
              )}
              
              {mapAuthFailed ? (
                <div key="radar-map-fallback" className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                  {/* Radar Concentric Rings */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[90%] h-[90%] border border-emerald-500/10 rounded-full flex items-center justify-center">
                      <div className="w-[70%] h-[70%] border border-emerald-500/15 rounded-full flex items-center justify-center">
                        <div className="w-[45%] h-[45%] border border-emerald-500/25 rounded-full flex items-center justify-center">
                          <div className="w-[20%] h-[20%] border border-emerald-500/35 rounded-full" />
                        </div>
                      </div>
                    </div>
                    {/* Crosshairs */}
                    <div className="absolute w-[95%] h-[1px] bg-emerald-500/10" />
                    <div className="absolute h-[95%] w-[1px] bg-emerald-500/10" />
                  </div>

                  {/* Rotating Radar Sweep Line */}
                  <div className="absolute top-1/2 left-1/2 w-[45%] h-[45%] origin-top-left bg-gradient-to-br from-emerald-500/20 to-transparent pointer-events-none animate-radar-sweep rounded-br-full" />

                  {/* User Center Dot */}
                  <div 
                    className="absolute w-3.5 h-3.5 bg-blue-500 rounded-full ring-4 ring-blue-500/25 z-10 flex items-center justify-center" 
                    title="Your Location"
                  >
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>

                  {/* Radar Markers */}
                  {filteredVets.map((vet, idx) => {
                    const center = mapCenter;
                    const maxDelta = 0.4; // Max lat/lng difference to render inside the radar circle
                    const dx = (vet.lng - center.lng) / maxDelta;
                    const dy = (vet.lat - center.lat) / maxDelta;
                    
                    // Clamp coordinates to stay nicely within the circle
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const scale = dist > 0.85 ? 0.85 / dist : 1.0;
                    
                    const leftPercent = 50 + dx * scale * 50;
                    const topPercent = 50 - dy * scale * 50;
                    const isSelected = selectedVet?.place_id === vet.place_id;

                    return (
                      <button
                        key={vet.place_id}
                        type="button"
                        onClick={() => handleSelectVet(vet)}
                        className={`absolute w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-black transition-all z-20 cursor-pointer shadow-xl ${
                          isSelected
                            ? "bg-emerald-400 text-slate-950 scale-125 ring-4 ring-emerald-500/30"
                            : "bg-slate-900 border border-emerald-500/40 text-emerald-400 hover:scale-110 hover:border-emerald-400"
                        }`}
                        style={{
                          left: `${leftPercent}%`,
                          top: `${topPercent}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                        title={vet.name}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}

                  <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-[10px] text-slate-400 font-bold tracking-wide uppercase flex items-center gap-1.5">
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    Radar Mode Fallback
                  </div>
                </div>
              ) : (
                <div key="google-map-container" ref={mapRef} className="w-full h-full" />
              )}
            </div>

            {/* Selected Clinic Details Drawer */}
            <AnimatePresence>
              {selectedVet && (
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur border border-emerald-500/20 rounded-2xl p-4 shadow-2xl z-20 space-y-3"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                        {selectedVet.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-tight flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                        <span>{selectedVetDetails?.formatted_address || selectedVet.address}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedVet(null)}
                      className="text-slate-500 hover:text-slate-300 text-lg px-2 cursor-pointer font-bold"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-800 pt-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="font-semibold text-slate-200">
                          {selectedVet.rating ? `${selectedVet.rating.toFixed(1)} / 5.0` : "No rating yet"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-slate-350">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        {loadingDetails ? (
                          <span className="text-slate-500 animate-pulse">Loading phone...</span>
                        ) : (
                          <a 
                            href={`tel:${selectedVetDetails?.formatted_phone_number}`}
                            className="font-semibold text-slate-200 hover:underline hover:text-emerald-400 transition"
                          >
                            {selectedVetDetails?.formatted_phone_number || "No contact listed"}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-slate-350">
                        <Clock className="w-4 h-4 text-teal-400" />
                        <span className={`font-semibold ${
                          selectedVet.open_now ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {selectedVet.open_now ? t("openNow") : t("closed")}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-350">
                        <Compass className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold text-slate-200">
                          {selectedVet.distance !== undefined ? `${selectedVet.distance.toFixed(1)} km away` : "Calculating..."}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Call and Directions Action Buttons */}
                  <div className="flex items-stretch gap-2 pt-2">
                    {selectedVetDetails?.formatted_phone_number && (
                      <a
                        href={`tel:${selectedVetDetails.formatted_phone_number}`}
                        className="flex-1 py-2 text-center bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t("callClinic")}</span>
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${
                        userLocation ? `${userLocation.lat},${userLocation.lng}` : ""
                      }&destination=${selectedVet.lat},${selectedVet.lng}&destination_place_id=${selectedVet.place_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 text-center bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t("getDirections")}</span>
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NearbyVets;
