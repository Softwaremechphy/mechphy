const WS_CONFIG = {
  BASE_URL: 'ws://192.168.1.17',
  HTTP_BASE_URL: 'http://192.168.1.17', // Added HTTP base URL for API calls
  // Real-Time Monitoring Ports (RTM)
  RTM_PORTS: {
    SOLDIER_DATA: 8001,
    KILL_FEED: 8002,
    STATS: 8003,
  },
  // After Action Review Ports (AAR)
  AAR_PORTS: {
    SOLDIER_DATA: 8765,
    KILL_FEED: 8766,
    STATS: 8767,
  },
  // HTTP API Ports
  API_PORTS: {
    REPLAY_INIT: 8000,
  },
  // Legacy properties for backward compatibility
  PORTS: {
    SOLDIER_DATA: 8001,
    KILL_FEED: 8002,
    STATS: 8003,
  },
};

// Real-Time Monitoring WebSocket URLs
WS_CONFIG.getSoldierWsUrl = () => `${WS_CONFIG.BASE_URL}:${WS_CONFIG.RTM_PORTS.SOLDIER_DATA}/ws`;
WS_CONFIG.getKillFeedWsUrl = () => `${WS_CONFIG.BASE_URL}:${WS_CONFIG.RTM_PORTS.KILL_FEED}/ws`;
WS_CONFIG.getStatsWsUrl = () => `${WS_CONFIG.BASE_URL}:${WS_CONFIG.RTM_PORTS.STATS}/ws`;

// After Action Review WebSocket URLs
WS_CONFIG.getAARSoldierWsUrl = () => `${WS_CONFIG.BASE_URL}:${WS_CONFIG.AAR_PORTS.SOLDIER_DATA}/ws`;
WS_CONFIG.getAARKillFeedWsUrl = () => `${WS_CONFIG.BASE_URL}:${WS_CONFIG.AAR_PORTS.KILL_FEED}/ws`;
WS_CONFIG.getAARStatsWsUrl = () => `${WS_CONFIG.BASE_URL}:${WS_CONFIG.AAR_PORTS.STATS}/ws`;

// HTTP API URLs
WS_CONFIG.getReplayInitUrl = () => `${WS_CONFIG.HTTP_BASE_URL}:${WS_CONFIG.API_PORTS.REPLAY_INIT}/initialize-replay`;

// Utility function to get all WebSocket URLs for CSP
WS_CONFIG.getAllWebSocketUrls = () => [
  WS_CONFIG.getSoldierWsUrl(),
  WS_CONFIG.getKillFeedWsUrl(),
  WS_CONFIG.getStatsWsUrl(),
  WS_CONFIG.getAARSoldierWsUrl(),
  WS_CONFIG.getAARKillFeedWsUrl(),
  WS_CONFIG.getAARStatsWsUrl(),
];

// Utility function to get all HTTP API URLs for CSP
WS_CONFIG.getAllHttpApiUrls = () => [
  WS_CONFIG.getReplayInitUrl(),
];

export { WS_CONFIG };

// Debug: Log the URLs being used

console.log('Real-Time Monitoring WebSocket URLs:', {

soldier: WS_CONFIG.getSoldierWsUrl(),

killFeed: WS_CONFIG.getKillFeedWsUrl(),

stats: WS_CONFIG.getStatsWsUrl(),

});

console.log('After Action Review WebSocket URLs:', {

soldier: WS_CONFIG.getAARSoldierWsUrl(),

killFeed: WS_CONFIG.getAARKillFeedWsUrl(),

stats: WS_CONFIG.getAARStatsWsUrl(),

});

console.log('HTTP API URLs:', {

replayInit: WS_CONFIG.getReplayInitUrl(),

});

console.log('All WebSocket URLs for CSP:', WS_CONFIG.getAllWebSocketUrls());
