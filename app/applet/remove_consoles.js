const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
        walkDir(dirPath, callback);
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(f)) {
        callback(dirPath);
      }
    }
  });
}

walkDir('.', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  // Remove console.log, console.error, console.warn, console.info, console.debug statements
  // This regex matches console.xxx(...) across lines until matching closing paren
  let updated = content.replace(/\bconsole\.(log|error|warn|info|debug)\s*\([\s\S]*?\);\s*/g, '');
  // Also catch any remaining console statements without semicolons or inside blocks
  updated = updated.replace(/\bconsole\.(log|error|warn|info|debug)\s*\([\s\S]*?\)\s*/g, '');
  
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    }
});
