# 源码与恢复说明

本仓库保存插件源码、前端资源、测试与部署示例，不包含登录凭据、VNC 密码、Chrome 数据、截图或运行日志，也不是完整服务镜像。

从仓库页面复制克隆地址，再执行：

```sh
git clone <repository-url>
cd dsh-browser-desktop
node --test test.mjs
```

部署前请阅读 README.md，按自己的服务账户、路径和系统环境审查配置。部署脚本面向 Ubuntu/systemd，不可直接在 macOS 运行，不应覆盖已有生产环境。

后续源码变更需要自行 commit 并 push；远程仓库不会自动同步服务器上的修改。禁止提交运行密钥和浏览器会话。
