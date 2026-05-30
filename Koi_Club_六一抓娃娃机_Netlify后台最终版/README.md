# Koi Club 六一抓娃娃机 Netlify 后台版

入口：
- 顾客端：/
- 后台端：/admin

默认后台密码：koi061

建议上线后在 Netlify 环境变量设置：
ADMIN_KEY = 你自己的后台密码

部署：
1. 解压本包。
2. 上传全部文件到 GitHub 仓库。
3. 在 Netlify 选择 Add new project -> Import from GitHub。
4. Build command: npm install && npm run build
5. Publish directory: public
6. Functions directory: netlify/functions
7. Deploy。
