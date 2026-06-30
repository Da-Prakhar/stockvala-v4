# How to integrate V2 files into the existing V1 backend

## 1. Copy files
cp -r stockvala-v2/backend/redis   stockvala-platform/packages/backend/src/redis
cp    stockvala-v2/backend/services/mt5Direct.service.js \
      stockvala-platform/packages/backend/src/services/

## 2. Add to app.cjs (or index.js) — init Redis + price stream on startup

```js
import { connectRedis } from './redis/client.js';
import { startPriceStream } from './redis/priceStream.js';

// After creating the Socket.IO server:
await connectRedis();
startPriceStream(io);
```

## 3. Replace mt5 service calls (gradual migration)

In any route/controller that calls the Python Flask bridge:
```js
// Before
import mt5Service from '../services/mt5.service.js';

// After
import mt5Service from '../services/mt5Direct.service.js';
```
The interface is identical — no other changes needed.

## 4. Add Redis env vars to .env
```
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

## 5. Copy trade follow/unfollow — write to Redis
In copyTrade.routes.js follow handler, add after DB insert:
```js
import { setFollower, removeFollower } from '../redis/client.js';

// On follow:
await setFollower(masterMt5Login, followerMt5Login, { ratio: 1.0, maxLot: 1.0 });

// On unfollow:
await removeFollower(masterMt5Login, followerMt5Login);
```
