# DSH 浏览器桌面

独立、免构建的 DSH 插件。使用原生 `sidebar.panellist` / `main` 插槽提供“浏览器桌面”入口，同源 iframe 显示 Xvfb :99 上的真实 Chrome。

## 功能

鼠标与键盘操作、重连、适应窗口或原始大小、全屏，以及打开 HTTP(S) 网页。关闭面板不会关闭 Chrome。同一 DISPLAY=:99 的有界面浏览器可显示；无头浏览器或其他容器不会自动显示。

“心情看板”快捷按钮依赖另行安装的对应模块；不属于本插件自带功能。

## 安全边界

页面位于 `/browser-desktop/view/`。全部 HTTP 资源、凭据 API 与 WebSocket 升级均通过 DSH 的 `connection.requestRejection` 校验；写操作与 WebSocket 还要求同源 Origin。VNC 密码随机生成，通过经过登录保护的 no-store session API 取得，不写入 URL、日志或客户端源码。

VNC 与 websockify 分别只监听 127.0.0.1:15999 与 127.0.0.1:16090。不要将它们直接暴露到公网。此功能具有服务器桌面操作权限，只向可信用户开放。其他插件的鉴权不在本插件保护范围内。

## 环境与部署

需要兼容的 DSH webServer / connection / 客户端插槽接口，以及 Ubuntu 上的 Google Chrome、x11vnc、novnc、websockify、openbox。noVNC 静态资源预期位于 `/usr/share/novnc`。

部署示例脚本为 `deployment/setup-infra.py`，不是跨平台一键安装器。示例采用专用服务用户及组 `dsh`，家目录 `/home/dsh`；UID/GID 从系统账户查询。执行前应先创建并检查账户，确认现有 `dsh-xvfb.service` 使用 :99 和 `/run/dsh-xvfb/Xauthority`，并确保服务账户可访问 Xauthority。DSH 应使用同一服务账户；否则需要显式配置凭据位置及浏览器启动权限。

服务目标 `dsh-browser-desktop.target` 管理窗口管理器、VNC、websockify 和 Chrome。`dsh.service` 的 drop-in 增加目标依赖及 `BROWSER=/usr/local/libexec/dsh-browser-open`。脚本需要 root，执行时会创建文件、启用并启动相关服务，但不会重启 DSH。禁止在已有部署上盲目重跑；先审查脚本与备份服务配置。浏览器 helper 仅允许 HTTP(S) / about:blank，不执行特定域名的 URL 改写。

以实际 DSH 服务用户安装插件，例如：

```sh
dsh plugin --profile web add --offline --ignore-scripts /path/to/dsh-browser-desktop
```

确认实际安装链接和插件启用状态后，再按维护窗口重启对应 DSH 实例。更新源码后也要检查实际运行副本，不能只看源目录。

## 数据位置

插件默认从运行用户家目录下 `.config/dsh-browser-desktop/session.json` 读取 VNC 凭据，可用环境变量 `DSH_BROWSER_SESSION_FILE` 指定其他路径。部署示例将凭据保存到 `/home/dsh/.config/dsh-browser-desktop/`，Chrome 数据保存在 `/home/dsh/.local/share/dsh-browser-desktop/chrome-profile`。

这些运行数据不属于源码，禁止提交到仓库。备份时应按登录会话及密钥保护。

## 测试

```sh
node --test test.mjs
```

本地测试模拟 DSH 接入对象，只验证契约及安全守卫，不代表真实桌面连接成功。部署后还应验证未登录拒绝、合法登录、HTTP、WebSocket、noVNC 桌面及实际鼠标键盘输入。

## 停用

先从对应 web profile 移除插件但暂不重启，停用 `dsh-browser-desktop.target`，移除对应服务 drop-in 并 daemon-reload，最后重启该 DSH 实例，清除 BROWSER 环境与客户端模块。不要误删已有 Xvfb、其他浏览器数据或其他实例。凭据与浏览器数据默认保留，删除前另行确认。
