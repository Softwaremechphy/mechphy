const path = require('path');

const { WS_CONFIG } = require('./config');

const nextConfig = {

reactStrictMode: true,

async rewrites() {

return [

{

source: '/api/:path*',

destination: 'http://localhost:8000/api/:path*',

},

{

source: '/aar-api/:path*',

destination: 'http://localhost:8001/api/:path*',

},

];

},

webpack: (config, { isServer }) => {

config.experiments = {

...config.experiments,

asyncWebAssembly: true,

layers: true,

};

return config;

},

async headers() {

const httpBaseUrl = WS_CONFIG.BASE_URL.replace('ws://', 'http://') + ':3000';

// Explicitly define all WebSocket URLs to avoid runtime issues

const allWebSocketUrls = [

'ws://192.168.1.17:8001/ws',

'ws://192.168.1.17:8002/ws',

'ws://192.168.1.17:8003/ws',

'ws://192.168.1.17:8765/ws',

'ws://192.168.1.17:8766/ws',

'ws://192.168.1.17:8767/ws',

];

// Add HTTP API URLs for CSP

const allHttpApiUrls = [

'http://192.168.1.17:8000',

'http://localhost:8000',

'http://localhost:8001',

];

const webSocketUrlsString = allWebSocketUrls.join(' ');

const httpApiUrlsString = allHttpApiUrls.join(' ');

return [

{

source: '/(.*)',

headers: [

{

key: 'Content-Security-Policy',

value: `

default-src 'self';

script-src 'self' 'unsafe-eval' 'unsafe-inline';

style-src 'self' 'unsafe-inline';

img-src 'self' data: blob: ${httpBaseUrl};

font-src 'self';

connect-src 'self' ${httpBaseUrl} ${webSocketUrlsString} ${httpApiUrlsString};

worker-src 'self' blob:;

media-src 'self' data: blob:;

object-src 'none';

base-uri 'self';

form-action 'self';

frame-ancestors 'none';

`.replace(/\s{2,}/g, ' ').trim(),

},

{

key: 'X-Frame-Options',

value: 'DENY',

},

{

key: 'X-Content-Type-Options',

value: 'nosniff',

},

{

key: 'Referrer-Policy',

value: 'strict-origin-when-cross-origin',

},

],

},

];

},

env: {

WS_BASE_URL: WS_CONFIG.BASE_URL,

HTTP_BASE_URL: WS_CONFIG.HTTP_BASE_URL,

RTM_SOLDIER_PORT: WS_CONFIG.RTM_PORTS.SOLDIER_DATA.toString(),

RTM_KILL_FEED_PORT: WS_CONFIG.RTM_PORTS.KILL_FEED.toString(),

RTM_STATS_PORT: WS_CONFIG.RTM_PORTS.STATS.toString(),

AAR_SOLDIER_PORT: WS_CONFIG.AAR_PORTS.SOLDIER_DATA.toString(),

AAR_KILL_FEED_PORT: WS_CONFIG.AAR_PORTS.KILL_FEED.toString(),

AAR_STATS_PORT: WS_CONFIG.AAR_PORTS.STATS.toString(),

REPLAY_INIT_PORT: WS_CONFIG.API_PORTS.REPLAY_INIT.toString(),

},

};

module.exports = nextConfig;
