# 捏一会吧

**你的 vibe coding 解压搭子。模型思考时捏一捏，回复时可爱地提醒你。**

捏一会吧是一款 macOS 透明悬浮桌宠。把水果、点心和软泥放在桌面角落，通过点按、长按、揉拉与 ASMR 声音，让等待 AI 生成的空隙变成短暂放松的时刻。

面向使用 AI 编程、设计和创作的人。希望桌宠除了小动物，也能是一个可捏、可听、可回应的小物体；未来还希望连接实体捏捏硬件。

> 当前为 macOS 本地原型，应用包名称仍是「捏一会儿.app」。运行时不调用模型，也不需要 API Key。
>
> **源码与运行素材分开打包。** 首次构建需导入 `nienie-runtime-assets-v1.zip`；素材不直接提交 Git。当前生气短哼为原创合成音，首次公开使用不含旧音频历史的源码快照。发布文件的制作步骤见[发布指南](docs/发布指南.md)。

## 能做什么

- **随手捏一捏**：点按推进破壳，松手保留进度；连续长按 2 秒，壳片飞散，留下可以继续按扁和揉拉的软芯。
- **听得到的反馈**：渐进碎裂声、软泥揉压实录与完成提示音跟随动作触发，静止时不循环播放揉拉音。
- **八款桌面小物**：冰霜荔枝、蜜桃、橘子、山竹、蛋挞、奶酪块、笑脸烤年糕、豆大福。
- **等待结束的小提醒**：接入 Codex 后，本轮有回复时捏捏恢复完整、轻浮并泛起柔光，弹出任务名；正在捏时先排队，松手后再提示。
- **轻巧地待在桌面**：透明区域允许点击穿透，不主动抢占键盘焦点；支持拖动、菜单栏收起和全局快捷键。
- **本地运行**：动画和声音嵌入应用包，任务通知通过本地文件传递。素材制作与日常运行分开，捏一下不会发起生成请求。

## 怎么玩

| 操作 | 效果 |
| --- | --- |
| 点按物体 | 推进一点破壳进度 |
| 按住，未满 2 秒松开 | 持续挤压，松手保留破损；蓄力不跨次累计 |
| 连续按住 2 秒 | 炸开外壳，出现“我炸了 😡”气泡与短哼 |
| 起爆后松手，再按住或拖动 | 按扁、揉拉软芯 |
| 顶部双向箭头 | 按上述八款顺序换一个完整物体 |
| 顶部 ↻ | 恢复当前种类，不切换物体 |
| 顶部双横线 / 减号 | 拖动窗口 / 收起到菜单栏 |
| `Control + Option + N` | 显示或收起，保留当前捏压状态 |
| 点击完成提醒正文 / × | 打开对应 Codex 对话 / 只关闭提醒 |

快捷键需要应用已在运行，并在松开按键时切换。若注册失败，菜单会提示不可用，仍可使用菜单栏手形图标显示或退出。当前界面没有音量、静音设置面板；沿用本机已保存的偏好，新用户使用默认音量。

## 从源码运行

### 1. 环境

| 依赖 | 用途 |
| --- | --- |
| macOS 13 或更新版本 | AppKit / WebKit 桌面窗口；目前没有 Windows / Linux 桌面实现 |
| Xcode Command Line Tools | `clang` 编译原生程序及本地签名工具 |
| Node.js | 打包前端和运行测试；本次验证版本为 24.14.0 |
| Python 3.9+ | 构建配置、Codex 通知与素材脚本 |

没有 npm 第三方依赖，无需执行 `npm install`。如果尚未安装 Command Line Tools，可运行 `xcode-select --install`，然后按系统提示完成安装。

### 2. 准备运行素材

下载或克隆源码后，进入仓库根目录。取得与源码对应的 `nienie-runtime-assets-v1.zip`，执行：

```sh
# 将路径替换为你下载或收到的素材包位置
python3 scripts/runtime_assets.py verify /path/to/nienie-runtime-assets-v1.zip
python3 scripts/runtime_assets.py install /path/to/nienie-runtime-assets-v1.zip
```

校验覆盖文件清单、SHA-256 和图集合同。导入只写入所需运行素材：相同文件跳过，遇到不同的本机文件则停止，不覆盖现有修改。素材包应来自项目维护者；内置哈希用于检查完整性，不是发布者身份签名。

从 [v0.1.0 Release](https://github.com/liuqiushi65-cmyk/nienie/releases/tag/v0.1.0) 下载[运行素材包](https://github.com/liuqiushi65-cmyk/nienie/releases/download/v0.1.0/nienie-runtime-assets-v1.zip)，可用同页的 `SHA256SUMS.txt` 校验。源码和素材分开提供，导入后目录如下：

```text
artifacts/
├── <material>-sequence/
│   ├── manifest.json
│   └── atlas-0.png … atlas-4.png
├── anger-burst/
│   └── <material>-core.png
└── slime-audio/
    └── samples.json
```

`<material>` 需要覆盖全部八款：

```text
lychee  peach  orange  mangosteen  egg-tart  cheese  mochi  daifuku
```

每款当前使用 80 帧、448 × 448 的透明序列，分为五张图集，外加一张独立软芯。软泥音频为 44.1 kHz PCM 采样数据，捏压、拉伸、回折各六个变体。打包器读取并内嵌这些文件；缺失或不符合合同会报错。

已有完整处理后素材时，不需要重新生成视频。若要从源视频准备素材，参阅[透明交互荔枝](docs/透明交互荔枝.md)、[点心接入](docs/点心捏捏接入.md)、[笑脸年糕](docs/笑脸年糕接入.md)、[豆大福](docs/豆大福接入.md)和[软泥实录音效](docs/软泥实录音效.md)。离线处理额外需要 FFmpeg 及以下 Python 依赖：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install numpy Pillow opencv-python scipy
```

素材脚本中的源文件路径、裁剪位置和抠图约束针对已验收的原片编写，不能仅替换成任意视频就得到相同效果。

### 3. 构建、安装、启动

素材就绪后，在项目根目录运行：

```sh
bash scripts/build.sh
bash scripts/install.sh
bash scripts/run.sh
```

- 构建产物：`build/捏一会儿.zip`。
- 默认安装位置：`~/Applications/捏一会儿.app`，也可双击启动。
- 应用使用本地 ad-hoc 签名，尚未公证；当前构建流程用于本机体验，未提供通用分发安装包。
- 构建会写入当前项目的绝对路径，用于定位通知文件和说明文档。移动项目后需要重新构建；已连接通知时，先按下节还原入口，再移动、重新接入。

更新时先从菜单栏退出旧应用，再重新执行这三条命令。`install.sh` 只在 ZIP 不存在时自动构建；已有 ZIP 时会直接安装，因此修改源码后应先显式构建。

可通过环境变量 `NIENIE_INSTALL_DIR` 自定义安装目录，安装和启动时使用相同值。不连接 Codex 也可以自由捏。

## 连接 Codex 完成提醒

完成提醒使用 `agent-turn-complete` 通知入口，接收本机任务的新回复。**“本轮已回复”只表示一轮回答结束，不表示代码、测试或业务任务已成功。**

在项目根目录执行：

```sh
# 只查看拟配置入口和已有通知程序
python3 scripts/configure_notify.py

# 安装：修改 Codex 配置的顶层 notify，保留并转发原通知程序
python3 scripts/configure_notify.py --install

# 卸载连接：精确还原安装前的 notify
python3 scripts/configure_notify.py --remove
```

默认读取 `~/.codex/config.toml`；设置了 `CODEX_HOME` 时使用该目录，也可以通过 `--config <配置文件路径>` 指定。脚本要求配置文件已存在；首次使用 Codex 的用户应先完成 Codex 自身初始化。

安装器只处理能安全解析的单行通知数组，遇到不支持的配置格式会停止。原通知入口记录在 `.runtime/notify-forward.json`：**移动或删除项目之前先运行 `--remove`，保留这个恢复文件直到还原完成。**

保持捏捏在后台运行，在 Codex 中发送一条新消息验证。若已打开的任务没有触发，待其他任务结束后正常重启 Codex 客户端，再测试配置是否加载。提醒会自动结束，也可点击关闭；多条提醒依次显示，启动前的历史不会补播。

本机曾收到真实完成事件并验证复原提醒；其他机器和客户端版本需要各自验证。提醒正文跳转已实现，但尚未完成真实鼠标点击后到达目标对话的端到端验收。配置行为、恢复步骤和历史排查见 [Codex 完成提醒](docs/Codex完成提醒.md)。

项目还保留可选 Hooks 入口，用于单任务工作状态，需要独立审核信任；目前没有真实 Hook 事件验收记录。**完成提醒不依赖 Hooks**，无需为了收到回复提醒额外配置它。

## 本地数据与隐私

- 完成接收器只把任务 ID、轮次 ID、任务标题和时间写入 `.runtime/completions.json`，最多保留 64 条记录。
- 标题来自本机 `session_index.jsonl` 索引，不打开会话正文；本项目不持久化通知中的输入和模型回答。已有通知程序会继续收到原始通知参数。
- 桌面应用每秒轮询本地通知文件，不启动网络监听端口，也不向模型发送请求。
- 窗口位置、物体选择和声音偏好保存在本机。`.runtime/`、生成素材、测试记录和构建产物均被 Git 忽略。

## 实现方式与边界

原生层使用 **Objective-C + AppKit + WKWebView**，负责透明非激活悬浮窗口、点击穿透、拖动、菜单栏和快捷键；前端使用 **Canvas + Web Audio**，负责画面、受力反馈与声音。

破壳阶段由鼠标推进预先制作的透明帧序列；破壳后用软芯纹理网格表现按扁和揉拉。这样可以保留素材中的材质细节，但裂纹沿固定路径发展，尚不能自由撕裂、任意折叠或模拟真实三维断裂。内芯有半透明观感，不会折射桌面内容。

原生计时器在交互和动效期间驱动画面，处理非激活窗口中浏览器动画帧可能暂停的问题；静置时停止画面驱动，本地通知轮询仍继续。运行时无需视频生成服务；制作新物体时才可能涉及独立的图片、视频或声音制作流程。

```text
app/native/main.m            macOS 窗口、快捷键与本地通知读取
app/web/app.mjs              输入事件、视图和原生桥接
app/web/sequence.mjs         当前八款物体的逐帧交互与两秒起爆
app/web/model.mjs            材质、网格受力和任务状态
app/web/completion.mjs       完成提醒的去重、排队与过期
app/web/*renderer.mjs        透明图集、软芯网格和碎片绘制
app/web/audio.mjs            音频合成、实录采样与播放控制
scripts/bundle.mjs           内嵌资源并打包前端
scripts/runtime_assets.py    运行素材打包、校验与导入
scripts/configure_notify.py  安装或还原完成通知入口
scripts/codex_notify.py      完成事件接收与原通知转发
scripts/prepare-*.py         离线素材处理
tests/                      JavaScript、Python 与原生测试
docs/                       设计、素材制作和验证记录
```

## 测试

没有完整素材时，可以先运行以下核心逻辑与通知测试，不修改真实 Codex 配置：

```sh
node --test tests/model.test.mjs tests/sequence.test.mjs tests/completion.test.mjs
python3 -m unittest discover -s tests -p 'test_*notify.py'
```

完整素材及 Python 处理依赖就绪后：

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
bash scripts/test-native.sh
```

`tests/audio.test.mjs` 依赖 `artifacts/slime-audio/samples.json`，缺失时完整 Node 测试会失败。Python 抠图测试中的真实源片用例在素材缺失时会跳过，不能把跳过算作验证通过。

2026-09-27 核验：完整工作区 Node 79 项、Python 29 项通过；干净源码导入运行素材包后，Node 79 项通过、Python 27 项通过及 2 项源片测试跳过，原生快捷键测试、应用构建及严格签名校验通过。**这些结果不等于全平台兼容、原生交互或 ASMR 主观听感已经验收。** 详见[发布验证](docs/发布验证.md)及[历史验证记录](docs/验证记录.md)。

## 后续方向

- 完善安装、自动更新与卸载体验。
- 提升壳与软泥黏连、连续碎裂、回弹和声音同步的自然度。
- 提供更多物体、声音选择和主题，补齐面向用户的声音控制。
- 探索更多 AI 创作工具的任务状态接入。
- 探索实体捏捏硬件，将实际按压力度映射到屏幕形变与声音。

这些是探索方向，尚未全部实现；当前没有实体硬件连接或跨平台桌面客户端。

## 参与贡献

欢迎通过 Issue 提交体验反馈、复现问题或新物体建议。反馈请附 macOS 版本、操作步骤、预期与实际表现；提交截图或录屏前请移除私人任务名和对话内容。

修改交互规则、计时或通知逻辑时，请补充相应回归测试；素材变更请说明来源、许可与制作方式，并检查深浅背景的透明边缘。请勿提交个人 Codex 配置、`.runtime/`、原始录屏或未确认再分发许可的素材。大范围修改建议先通过 Issue 对齐。

## 素材与许可

原创程序代码、文档、项目生成的图片与动画，以及原创程序合成声音采用 [MIT License](LICENSE)。**第三方素材保留各自许可**；具体文件范围及来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

- 软泥实录来自 [breiti / Freesound](https://freesound.org/people/breiti/sounds/587848/)，来源页标注 CC0；处理方法见[软泥实录音效](docs/软泥实录音效.md)。
- 项目生成的静态图片、动画图集、软芯和创意封面已确认按 MIT 开放；构建所需的图集和软芯随独立运行素材包提供。
- 生气短哼已改为 `app/web/anger-voice.mjs` 中的原创电子合成，适用 MIT。旧的第三方人声样音不再进入当前源码和新构建，但仍存在本机旧提交中；首次公开使用干净源码快照，避免将旧历史一并发布。

本项目独立开发，与 OpenAI / Codex 无官方隶属关系。
