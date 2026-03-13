# 发布到网上（静态网页）

这个项目是纯静态站点（`index.html` + `styles.css` + `game.js`），可以发布到任意静态托管平台。

## 方案 A：GitHub Pages（推荐）

1. 在 GitHub 新建一个仓库（例如 `muyu-breaker`）。
2. 在本机把当前文件夹初始化并推送：

```bash
git init
git add .
git commit -m "publish"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

3. 到 GitHub 仓库 Settings → Pages：
   - Source 选 `Deploy from a branch`
   - Branch 选 `main`，folder 选 `/ (root)`
4. 等 1–2 分钟，Pages 会给你一个公开地址。

## 方案 B：Netlify（最省事）

1. 打开 Netlify 后台，新建站点
2. 直接把整个文件夹上传（或把 `index.html` 拖进去也行，但建议整个目录）
3. 发布后会得到公开地址

## 方案 C：Cloudflare Pages

1. 新建 Pages 项目
2. 选择 “Direct upload” 或连接 Git 仓库
3. Build 设置为空（无需构建），输出目录也留空/根目录即可

## 自定义域名（可选）

以上三家都支持绑定域名；如果你要用自定义域名，告诉我域名是什么，我可以补 `CNAME`（GitHub Pages）或给出 DNS 配置建议。

