const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('index.html not found in dist directory');
  process.exit(1);
}

const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Create dist/404.html as exact copy of index.html
fs.writeFileSync(path.join(distDir, '404.html'), indexContent);

// 2. Create static HTML copies for all app routes so refreshing never triggers 404
const routes = [
  'pos',
  'sales',
  'expenses',
  'dashboard',
  'catalog',
  'team',
  'shops',
  'reports',
  'receipt',
  'receipts',
  'settings',
  'admin',
  'sign-in',
  'sign-up',
  'verify',
];

for (const route of routes) {
  // e.g. dist/pos.html
  fs.writeFileSync(path.join(distDir, `${route}.html`), indexContent);

  // e.g. dist/pos/index.html
  const routeDir = path.join(distDir, route);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }
  fs.writeFileSync(path.join(routeDir, 'index.html'), indexContent);
}

console.log(`Successfully generated SPA fallbacks for ${routes.length} routes + 404.html`);

