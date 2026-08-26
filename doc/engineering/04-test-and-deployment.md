# 测试与发布证据

## 已执行

- `node --check`：覆盖 `src/` 与 `example/` 下全部 JavaScript 文件。
- `bash compile.sh`：所有独立 bundle 与 `odd.min.js` 完成拼接和 terser 压缩。
- `cmake --build build -j2`：odd.d 主程序构建通过。
- `cmake -S . -B build-ut -DUT=ON`：odd.d 单元测试目标已配置；构建在测试源阶段因仓库环境缺少 `gtest/gtest.h` 失败，尚未运行测试二进制。

## 未执行

- 浏览器截图和视觉像素比对：用户明确要求本轮暂不执行。
- 真实 IM、WHIP/WHEP、云游戏服务端到端联调：需要运行中的服务、ROM 与浏览器权限环境。
- 线上部署：未获授权，也不属于本轮范围。

## 发布与回滚

当前只生成本地 `release/` 产物，不提交、不推送、不部署。代码修改可按 odd.js、odd.d、odd.skills 三个仓库分别评审和回滚；无数据库或持久化迁移。
