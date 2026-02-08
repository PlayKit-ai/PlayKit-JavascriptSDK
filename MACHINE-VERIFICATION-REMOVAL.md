# MACHINE_VERIFICATION_TOKEN 移除计划

## 背景

原有的 `/api/service/get-player-global-token` 端点使用 `MACHINE_VERIFICATION_TOKEN` 进行服务间认证。

现在新增了 `/api/auth/get-player-global-token` 端点，使用 **Clerk token** 认证，适用于同域名下共享 Clerk 的服务（Space、PlayMimi 等）。

新方案更简洁：
- ✅ 不需要额外的 secret 管理
- ✅ 客户端可以直接调用（无需中转后端）
- ✅ 安全性由 Clerk 保证

---

## 变更概览

| 项目 | 变更内容 |
|------|----------|
| **PlayKit (Agentland-Developerworks)** | 新增 `/api/auth/get-player-global-token`，废弃 `/api/service/get-player-global-token` |
| **Space (Agentland-Space)** | 迁移到新端点，移除 `MACHINE_VERIFICATION_TOKEN` |
| **环境变量** | 移除 `MACHINE_VERIFICATION_TOKEN` |

---

## 迁移步骤

### Phase 1: PlayKit 部署新端点 ✅

**已完成**：新端点已创建

```
Agentland-Developerworks/developer_services/app/api/auth/get-player-global-token/route.ts
```

**端点对比**：

| 旧端点 | 新端点 |
|--------|--------|
| `POST /api/service/get-player-global-token` | `POST /api/auth/get-player-global-token` |
| `Authorization: Bearer {MACHINE_TOKEN}` | `Authorization: Bearer {clerkToken}` |
| `body: { userId }` | 无需 body（从 Clerk token 提取 userId） |
| channel: `backend` | channel: `clerk_auth` |

### Phase 2: 更新 Space

**文件**: `Agentland-Space/app/api/player/get-token/route.ts`

**当前代码**（使用 MACHINE_TOKEN）:
```typescript
// 旧代码
const externalResponse = await fetch('https://api.playkit.ai/api/service/get-player-global-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.MACHINE_VERIFICATION_TOKEN}`,
  },
  body: JSON.stringify({ userId }),
});
```

**新代码**（直接转发 Clerk token）:
```typescript
// 新代码
const externalResponse = await fetch('https://api.playkit.ai/api/auth/get-player-global-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`,  // 直接使用 Clerk token
  },
});
```

**完整更新后的文件**:
```typescript
// app/api/player/get-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@clerk/backend';
import { corsHeaders } from '@/lib/delivery-utils';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Extract Clerk token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No authorization token found' },
        { status: 401, headers: corsHeaders }
      );
    }

    const clerkToken = authHeader.substring(7);

    // Verify the Clerk token locally (optional, for logging)
    const sessionToken = await verifyToken(clerkToken, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    if (!sessionToken || !sessionToken.sub) {
      return NextResponse.json(
        { success: false, error: 'Invalid Clerk token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = sessionToken.sub;
    console.log(`[PLAYER-TOKEN-API] Fetching player token for user: ${userId}`);

    // Call the new PlayKit auth endpoint (forward Clerk token)
    const externalResponse = await fetch('https://api.playkit.ai/api/auth/get-player-global-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clerkToken}`,
      },
    });

    if (!externalResponse.ok) {
      const errorData = await externalResponse.json().catch(() => null);
      console.error('[PLAYER-TOKEN-API] External API error:', externalResponse.status, errorData);

      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch player token: ${externalResponse.status}`,
          details: errorData?.error || 'Unknown error'
        },
        { status: externalResponse.status, headers: corsHeaders }
      );
    }

    const tokenData = await externalResponse.json();

    if (!tokenData.success) {
      console.error('[PLAYER-TOKEN-API] External API returned error:', tokenData);
      return NextResponse.json(
        { success: false, error: tokenData.error || 'Failed to fetch player token' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[PLAYER-TOKEN-API] Successfully fetched player token for user: ${userId}`);

    return NextResponse.json(
      {
        success: true,
        userId: tokenData.userId,
        globalToken: tokenData.globalToken,
        tokenName: tokenData.tokenName,
        createdAt: tokenData.createdAt,
        expiresAt: tokenData.expiresAt,
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[PLAYER-TOKEN-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
```

### Phase 3: 移除环境变量

**Space 项目**：

```bash
# 从 .env 或环境变量配置中移除
- MACHINE_VERIFICATION_TOKEN=xxx
```

**Vercel/部署平台**：
- 进入 Space 项目的环境变量设置
- 删除 `MACHINE_VERIFICATION_TOKEN`

### Phase 4: 废弃旧端点

**文件**: `Agentland-Developerworks/developer_services/app/api/service/get-player-global-token/route.ts`

**选项 A**: 添加废弃警告（过渡期）
```typescript
export async function POST(request: NextRequest) {
  console.warn('[DEPRECATED] /api/service/get-player-global-token is deprecated. Use /api/auth/get-player-global-token instead.');
  // ... 保持原有逻辑
}
```

**选项 B**: 直接删除（如果确认无其他调用方）
```bash
rm -rf app/api/service/get-player-global-token/
```

### Phase 5: 移除 PlayKit 的环境变量

确认无服务使用后：

```bash
# 从 PlayKit (Agentland-Developerworks) 环境变量中移除
- MACHINE_VERIFICATION_TOKEN=xxx
```

---

## 迁移检查清单

### 准备阶段
- [ ] 新端点 `/api/auth/get-player-global-token` 已部署到 PlayKit
- [ ] 新端点测试通过

### Space 迁移
- [ ] 更新 `app/api/player/get-token/route.ts` 使用新端点
- [ ] 本地测试通过
- [ ] 部署 Space
- [ ] 生产环境验证 token 获取正常
- [ ] 移除 Space 的 `MACHINE_VERIFICATION_TOKEN` 环境变量

### 清理阶段
- [ ] 确认无其他服务使用旧端点
- [ ] 删除或废弃 `/api/service/get-player-global-token`
- [ ] 移除 PlayKit 的 `MACHINE_VERIFICATION_TOKEN` 环境变量
- [ ] 更新 API 文档

---

## 回滚方案

如果迁移出现问题：

1. Space 回滚到使用 `MACHINE_VERIFICATION_TOKEN` 的版本
2. 恢复环境变量
3. PlayKit 旧端点保持可用

---

## 时间线

| 阶段 | 预计时间 | 状态 |
|------|----------|------|
| Phase 1: 新端点部署 | - | ✅ 已完成 |
| Phase 2: Space 迁移 | - | ⏳ 待执行 |
| Phase 3: 移除 Space 环境变量 | Space 部署后 | ⏳ 待执行 |
| Phase 4: 废弃旧端点 | 观察 1 周后 | ⏳ 待执行 |
| Phase 5: 移除 PlayKit 环境变量 | 确认无调用后 | ⏳ 待执行 |
