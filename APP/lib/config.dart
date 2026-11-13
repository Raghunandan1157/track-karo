/// Single place for the backend base URL. Change this when the backend moves.
const String kApiBase = 'https://track-karo-rouge.vercel.app/api';

/// Tracking tuning.
const int kDistanceFilterMeters = 15; // new point after moving this far
const Duration kHeartbeatEvery = Duration(seconds: 60); // stationary time floor
const Duration kUploadEvery = Duration(seconds: 30);
const int kMaxPointsPerUpload = 500;
const int kMaxQueuedPoints = 20000;
const Duration kLocationCheckEvery = Duration(seconds: 5);

/// OpenStreetMap raster tiles (no API key).
const String kTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const String kTileUserAgent = 'com.trackkaro.track_karo';
