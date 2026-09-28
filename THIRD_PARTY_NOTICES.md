# 素材来源与许可范围

核对日期：2026-09-27。

根目录的 [MIT License](LICENSE) 适用于本项目原创程序代码、文档、原创程序合成声音，以及下表列明的项目生成图片和动画。维护者于 2026-09-27 明确确认将这些生成视觉素材按 MIT 开放。

第三方软泥实录保留 CC0 许可；第三方参考视频、配音、配乐及含有这些内容的演示剪辑不因进入项目目录或应用包而适用 MIT。具体范围如下。

## 软泥揉压实录

- 作者：breiti。
- 来源：[Freesound — Guck, Slime, slippery Jelly slowly kneading squeezing with Hands, some Bubbles](https://freesound.org/people/breiti/sounds/587848/)。
- 来源页许可：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，本次核对页面仍标注 Creative Commons 0。
- 使用位置：处理后的采样数据位于 `artifacts/slime-audio/samples.json`，构建时内嵌；该目录未纳入 Git。
- 修改：选段、响度处理、按动作裁剪、切点淡入淡出，不改变播放速度或音高。详细处理记录见[软泥实录音效](docs/软泥实录音效.md)。

## 生气短哼：已替换为原创合成

- 当前 `app/web/anger-voice.mjs` 使用原创谐波和下降音高合成 0.48 秒的电子短哼，不包含人声录音或 Base64 PCM 数据，适用 MIT。
- 历史原型曾使用声之浪潮“女孩1”公开样音，项目没有确认其再分发许可。2026-09-27 已从当前源码中移除，旧素材不纳入公开运行素材包。
- 本机旧 Git 提交仍含原样音，因此首次公开应使用不含旧历史的源码快照，不能直接推送本机全部开发历史。

旧音色的选段与试听记录仅为开发历史，见[两秒炸掉](docs/两秒炸掉.md)；不代表当前分发声音。

## 静态图片、视频与衍生素材

| 素材 | 制作来源 / 记录 | 许可与分发方式 |
| --- | --- | --- |
| `app/web/assets/lychee-shell.png`、`lychee-core.png` | 内置 ImageGen；见[荔枝素材说明](docs/荔枝素材说明.md) | MIT，随源码分发 |
| 八款物体的透明序列图集 | 项目生成的视频经裁剪、抠图和装箱；见各接入文档 | MIT，`artifacts/<material>-sequence/` 随运行素材包分发 |
| 八款起爆后的独立软芯图片 | 内置 ImageGen；见[两秒炸掉](docs/两秒炸掉.md)、点心及后续接入记录 | MIT，`artifacts/anger-burst/<material>-core.png` 随运行素材包分发 |
| 本项目自行生成的上述物体原始视频、图片和材质研究图 | 各自制作记录，不包括外部参考视频 | MIT；原片和中间产物不包含在最小运行素材包中 |
| `artifacts/competition-cover/捏一会吧-创意封面.png` | 内置 ImageGen；同目录保留提示词 | MIT；不包含在最小运行素材包中 |

其中 `<material>` 为 `lychee`、`peach`、`orange`、`mangosteen`、`egg-tart`、`cheese`、`mochi`、`daifuku`。分发这些 MIT 素材时保留根目录 LICENSE 中的版权与许可声明；运行素材 ZIP 已包含该文件与本说明。

用户提供的参考录屏、外部配音样音、第三方音乐和合成演示视频不在上述生成素材授权范围内，也不进入源码快照或运行素材包。新增素材需继续记录来源与许可，不能把整个 `artifacts/` 目录视为同一许可。

## 程序合成声音

`app/web/audio.mjs` 中原创的碎裂、颗粒与完成提示等合成逻辑随程序代码适用 MIT。第三方实录片段及上述短哼音频仍按各自条目处理。

## 商标与项目关系

OpenAI、Codex 及其他产品名称用于说明兼容对象或素材制作来源。本项目为独立项目，不表示相关厂商背书或官方隶属关系。
