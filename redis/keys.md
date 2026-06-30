# Redis Key Schema

## Price Feed (written by C# Gateway)
| Key | Type | Value |
|-----|------|-------|
| `price:EURUSD` | string | `{"bid":1.1,"ask":1.1001,"t":1716000000}` |
| `tick:EURUSD` | pub/sub channel | same JSON — Node.js subscribes |

## Live Positions (written by C# Gateway)
| Key | Type | Value |
|-----|------|-------|
| `positions:{accountId}` | hash | field=data, value=JSON positions array |
| `account:{id}:order` | pub/sub channel | order event JSON |
| `account:{id}:balance` | pub/sub channel | balance update JSON |

## Copy Trading (written by Node.js backend on follow/unfollow)
| Key | Type | Value |
|-----|------|-------|
| `copy:masters:active` | set | set of master account IDs |
| `copy:master:{id}:followers` | hash | field=followerAccountId, value=`{"ratio":1,"maxLot":1}` |
| `copy:follower:{id}:map` | hash | field=masterTicket, value=`{"symbol":"EURUSD","volume":0.1}` |
