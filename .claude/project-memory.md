# 项目记忆 - QR_Group_Scan (Scan2)

- **仓库**: https://github.com/ttieli/Scan2
- **分支**: main
- **描述**: QR 码离线数据传输工具（sender 编码 → receiver 扫描还原）

## 会话记录

---

### 2026-02-03 (会话ID: f1f2f3)

#### ✅ 完成
- 实现三项新功能（规划+实施）
- **F1**: 循环模式全屏大 QR 展示 — 复用 `#singleQRContainer`，新增 `#fullscreenLoopControls`，QR 缓存 `qrCache`，`startLoop()` 改用 `showQRCode()`，Space 暂停
- **F2**: 全屏模式页码输入框 — `<input id="pageNumberInput">` + `jumpToPage()`，键盘冲突处理
- **F3**: 接收端"显示缺失片段"按钮 — `showMissingFragments()` 支持文本（1-based）和文件（0-based）模式

#### 📋 计划
- 推送到 GitHub 并部署 GitHub Pages 进行实际测试

#### ⏸️ 未完成
- 未提交 git（用户未要求）
- 未做浏览器实际测试验证

#### ⚠️ 问题
-（无）

#### 💡 备注
- QR 缓存策略：`qrCache[index] = contentDiv.innerHTML`，缓存在 `qrCodes = []` 重置时同步清空
- `updateLoopQR()` 函数保留但不再被调用（可后续清理）
- 历史：Phase 1（T1-T10）→ Phase 2（T11-T13）→ Apple 重设计（T14-T18）→ QR bug fix → 进度地图+默认参数 → chunk size fix → F1/F2/F3

---

### 2026-02-03 (会话ID: qrfix_utf8)

#### ✅ 完成
- 修复长期存在的"第一张QR码生成失败"bug
- **根因**：嵌入式 QRCode.js 的 UTF-8 编码器 stale buffer bug — 数组 `b` 在循环迭代间未重置，中文字符后 ASCII 字符多添加垃圾字节
- **修复**：sender.html 第 303 行，循环体开头添加 `b=[];`
- 完成 Apple 风格重设计 T17/T18 收尾

#### 📋 计划
- 可用含中文文件名的文件测试验证修复

#### ⏸️ 未完成
- 未做浏览器实际测试验证

#### ⚠️ 问题
-（无）

#### 💡 备注
- 错误日志：`code length overflow. (5100>4184)`
- 仅 fragment 0 受影响（含文件名元数据中的中文字符），其余纯 ASCII base64 片段不受影响
- 使用了 systematic-debugging skill 进行 Phase 1-4 分析

---

### 2026-02-03 (会话ID: t17t18)

#### ✅ 完成
- 完成 Apple 风格视觉重设计全部 5 个任务（T14-T18）
- **T14**: index.html — Apple 色板（`--bg-primary: #000`, `--accent: #0071e3`），单一蓝色 accent，pill 按钮
- **T15**: sender.html CSS + HTML 重写
- **T16**: sender.html JS 内联样式更新为 Apple 橙/红
- **T17**: receiver.html CSS + HTML — 关键修复：`var(--accent-send)` → `var(--accent)`
- **T18**: receiver.html JS 内联样式更新为 Apple success/error 色

#### 📋 计划
- Apple 风格重设计全部完成

#### ⏸️ 未完成
-（无）

#### ⚠️ 问题
-（无）

#### 💡 备注
- 设计关键变更：双色 accent → 单一 Apple 蓝 `#0071e3`
- 按钮 pill 化（`border-radius: 980px`），卡片无 border
- 历史：Phase 1（T1-T10）→ Phase 2（T11-T13）→ Apple 重设计（T14-T18），共 18 个任务

---

### 2026-02-02 23:51:57 (会话ID: p2dk)

#### ✅ 完成
- 执行 Phase 2 视觉主题统一（全部 3 个任务）
- **T11**: Sender dark theme CSS — `:root` CSS 变量暗色风格
- **T12**: Receiver dark theme CSS — 粉色 accent
- **T13**: 内联样式清理 — sender + receiver 所有残留浅色内联样式
- 三个页面视觉风格完全统一

#### 📋 计划
- Phase 2 全部完成，可进行功能测试

#### ⏸️ 未完成
-（无）

#### ⚠️ 问题
-（无）

#### 💡 备注
- QR 码保持白底黑色，`.qr-item` 容器保持 `background: #fff`
- CSS 变量三文件一致，区别仅在 accent 色（后被 Apple 重设计统一为蓝色）

---

### 2026-02-02 23:39:24 (会话ID: p1ui)

#### ✅ 完成
- 执行 Phase 1 UI/UX 重构（全部 10 个任务）
- **T1**: 修复脆弱的 `querySelectorAll` 索引选择器 → `getElementById`
- **T2**: Sender tab 切换器（文本|文件）
- **T3**: 自动检测模式 + 实时估算 QR 数量
- **T4**: 高级选项折叠为 `<details>`
- **T5**: Receiver HTML 重构为 5 个状态容器
- **T6**: Receiver 状态管理 JS：`setState()` 等
- **T7**: 三页面统一深色导航栏
- **T8**: Sender 双语支持（`data-zh`/`data-en`）
- **T9**: Receiver 双语支持
- **T10**: index.html 语言持久化
- 总计 3 文件，823 行新增，358 行删除

#### 📋 计划
- Phase 2：视觉主题统一

#### ⏸️ 未完成
-（无）

#### ⚠️ 问题
-（无）

#### 💡 备注
- 所有现有元素 ID 保持不变，核心 QR 编码/解码逻辑未修改
- 语言切换通过 `localStorage('qr_lang')` 跨页面同步
- Receiver 状态机：video 元素在状态间通过 JS 移动

---

### 2026-02-02 会话：代码检查 + 修复计划
- **完成**: 全面代码检查，验证核心需求（纯离线、sender→receiver 流程）
- **发现 5 个 bug**: 版本号不一致、estimateQRCount 参数错误、alert+confirm 弹窗体验差、localStorage 配额无提示、非 HTTPS 无降级提示
- **产出**: `_local/TODO.md`（待办列表）、`_local/plans/2026-02-02-bugfix-plan.md`（8 个任务的详细修复计划）
- **状态**: 计划已写好，准备执行

### 2026-02-02 会话：执行修复计划
- **目标**: 按 bugfix plan 逐一执行 8 个任务
- **状态**: 进行中
