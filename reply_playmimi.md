# PlayMimi × PlayKit MVP 集成指南

## 概述

PlayMimi 部署到 `playmimi.playkit.ai`，利用 PlayKit 子域名的优势，**共享 PlayKit 的 Clerk 认证**，自行实现登录和 token 获取流程。

**核心原理**：
```
┌─────────────────────────────────────────────────────────────────────┐
│  playmimi.playkit.ai                                                │
│                                                                     │
│  1. 使用 PlayKit 的 Clerk                                           │
│  2. 用户登录 → 获取 Clerk session token                             │
│  3. 调用 PlayKit API → 获取 player token                            │
│  4. 存储 localStorage['shared_token']                               │
│  5. 使用 token 初始化 SDK / 调用 API                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

这与 `space.playkit.ai` 的实现方式相同。

---

## 前置条件

### PlayKit 侧配置

| 配置项 | 说明 | 负责人 |
|--------|------|--------|
| **Clerk Satellite Domain** | 在 Clerk Dashboard 添加 `playmimi.playkit.ai` | PlayKit |
| **DNS 配置** | 配置 `playmimi.playkit.ai` 指向 PlayMimi 服务 | PlayKit 运维 |
| **Game ID** | MVP 统一使用的 gameId：`______________` | PlayKit |

### PlayMimi 侧准备

- 前端集成 Clerk SDK（使用 PlayKit 的 Clerk keys）

---

## 实现方案

### 架构图

```
┌─────────────────────┐                    ┌─────────────────────┐
│  PlayMimi 前端       │                    │  PlayKit API        │
│  (playmimi.playkit.ai)                   │  (playkit.ai)       │
└──────────┬──────────┘                    └──────────┬──────────┘
           │                                          │
           │ 1. Clerk 登录 (PlayKit Clerk)            │
           │                                          │
           │ 2. 获取 Clerk token                       │
           │    useAuth().getToken()                  │
           │                                          │
           │ 3. POST /api/auth/get-player-global-token│
           │    Authorization: Bearer {clerkToken}    │
           │─────────────────────────────────────────>│
           │                                          │
           │                     4. verifyToken(clerkToken) → userId
           │                     5. createGlobalPlayerToken(userId)
           │                                          │
           │ 6. 返回 { globalToken, userId, ... }     │
           │<─────────────────────────────────────────│
           │                                          │
           │ 7. localStorage['shared_token'] = globalToken
           │                                          │
```

**优势**：
- ✅ 不需要 MACHINE_TOKEN
- ✅ PlayMimi 可以纯前端调用（无需自己的后端）
- ✅ 安全性由 Clerk 保证（同一 Clerk 实例）

---

## 实现步骤

### Step 1: 配置 Clerk

PlayMimi 使用 PlayKit 的 Clerk，需要在 Clerk Dashboard 配置 satellite domain。

```typescript
// .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx  // PlayKit 的 Clerk key
CLERK_SECRET_KEY=sk_xxx                    // PlayKit 的 Clerk secret (如果有后端)
```

```tsx
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}
```

### Step 2: 实现 Token 获取

```typescript
// lib/playkit-auth.ts

const PLAYKIT_API = 'https://playkit.ai';

/**
 * 使用 Clerk token 获取 PlayKit player token
 */
export async function fetchPlayerToken(clerkToken: string): Promise<string> {
  const response = await fetch(`${PLAYKIT_API}/api/auth/get-player-global-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${clerkToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get player token: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.globalToken) {
    throw new Error('Invalid response from PlayKit API');
  }

  return data.globalToken;
}

/**
 * 获取并存储 PlayKit player token
 */
export async function fetchAndStorePlayerToken(clerkToken: string): Promise<void> {
  const playerToken = await fetchPlayerToken(clerkToken);
  localStorage.setItem('shared_token', playerToken);
  console.log('[PlayKit] Player token stored');
}

/**
 * 获取已存储的 token
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('shared_token');
}

/**
 * 清除 token
 */
export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('shared_token');
}
```

### Step 3: 登录后自动获取 Token

```tsx
// components/PlayKitAuthProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { fetchAndStorePlayerToken, getStoredToken, clearStoredToken } from '@/lib/playkit-auth';

export function PlayKitAuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    async function initToken() {
      if (!isSignedIn) {
        clearStoredToken();
        return;
      }

      // 检查是否已有 token
      if (getStoredToken()) {
        return;
      }

      // 获取 Clerk token 并换取 player token
      try {
        const clerkToken = await getToken();
        if (clerkToken) {
          await fetchAndStorePlayerToken(clerkToken);
        }
      } catch (error) {
        console.error('[PlayKit] Failed to get player token:', error);
      }
    }

    initToken();
  }, [isSignedIn, getToken]);

  return <>{children}</>;
}
```

### Step 4: 使用 Token 调用 API

```typescript
// lib/playkit-api.ts
import { getStoredToken } from './playkit-auth';

const PLAYKIT_API = 'https://playkit.ai/api/external';

export async function getPlayerInfo() {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${PLAYKIT_API}/player-info`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}
```

### Step 5: 生成的游戏代码

```html
<script src="https://unpkg.com/playkit-sdk@latest/dist/playkit-sdk.umd.js"></script>
<script>
  const sdk = new PlayKitSDK.PlayKitSDK({
    gameId: 'mvp-game-id',  // PlayKit 提供的统一 gameId
  });

  await sdk.initialize();
  // SDK 会自动使用 localStorage['shared_token']
</script>
```

---

## PlayKit 需要提供

| 资源 | 用途 |
|------|------|
| **Clerk Satellite Domain 配置** | 允许 `playmimi.playkit.ai` 使用 PlayKit Clerk |
| **Game ID** | MVP 统一使用的 gameId |
| **DNS 配置** | `playmimi.playkit.ai` 子域名 |

---

## API 端点

### 获取 Player Token

```http
POST https://playkit.ai/api/auth/get-player-global-token
Authorization: Bearer {clerkToken}
Content-Type: application/json
```

**响应**：
```json
{
  "success": true,
  "userId": "user_xxx",
  "globalToken": "player-xxx-xxx",
  "tokenName": "Global Player Token (clerk_auth)",
  "channel": "clerk_auth",
  "balance": 10.5,
  "createdAt": "2025-01-26T12:00:00.000Z",
  "expiresAt": "2025-02-02T12:00:00.000Z"
}
```

> `balance` 为用户的 USD 余额

### SDK 文档（无需认证）

```http
GET https://docs.playkit.ai/llms.mdx/en/javascript/vibe-coding
```

### Player Info

```http
GET https://playkit.ai/api/external/player-info
Authorization: Bearer {playerToken}
```

---

## 测试清单

- [ ] Clerk satellite domain 配置完成
- [ ] PlayMimi 可使用 PlayKit Clerk 登录
- [ ] `/api/auth/get-player-global-token` 正确返回 player token
- [ ] token 正确存储到 localStorage
- [ ] 可调用 PlayKit External API
- [ ] SDK 可正常初始化

---

## 环境变量清单 (PlayMimi)

```bash
# Clerk (使用 PlayKit 的 keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx

# PlayKit Game ID
NEXT_PUBLIC_PLAYKIT_GAME_ID=xxx
```

> 注意：不再需要 `MACHINE_VERIFICATION_TOKEN`，认证完全通过 Clerk token 完成。
