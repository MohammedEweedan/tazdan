const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.expo') {
        filelist = walkSync(filePath, filelist);
      }
    } else {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        filelist.push(filePath);
      }
    }
  });
  return filelist;
};

const files = [
  ...walkSync(path.join(__dirname, '../src')),
  ...walkSync(path.join(__dirname, '../app'))
];

let modifiedCount = 0;

files.forEach(file => {
  // skip our new component
  if (file.includes('ui/Text.tsx')) return;

  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  // Regex to find import from 're  // Regex to find import from 're  // Regex to findst regex handles 99% of files
  // Match standard `import { View, Text } from 'react-native';`
  const rnImportRegex = /import\s+({[^}]+})\s+from\s+['"]react-native['"];?/g;
  
  let needsTextImport = false;
  let needsTextInputImport = false;

  content = content.replace(rnImportRegex, (match, importsStr) => {
    let imports = importsStr.split(',').map(s => s.trim().replace(/\n/g, '')).filter(s => s.length > 0);
    
    // Some imports might have whitespace or newlines inside the braces, let's normalize them
    // imports = '{ View, Text }' -> 'View', 'Text'
    imports = importsStr.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    const hasText = imports.includes('Text');
    const hasTextInput = imports.includes('TextInput');
    
    if (hasText) needsTextImport = true;
    if (hasTextInput) needsTextInputImport = true;
    
    // Remove Text and TextInput
    imports = imports.filter(i => i !== 'Text' && i !== 'TextInput');
    
    if (imports.length === 0) return '';
    return `import { ${imports.join(', ')} } from 'react-native';`;
  });

  if (needsTextImport || needsTextInputImport) {
    const importItems = [];
    if (needsTextImport) importItems.push('Text');
    if (needsTextInputImport) importItems.push('TextInput');
    
    const newImport = `import { ${importItems.join(', ')} } from '@/components/ui/Text';\n`;
    
    // Find where to inject
    const lines = content.split('\n');
    let injectIndex = 0;
    
    // Inject right after react-native import if exists, else below standard imports
    let foundRN = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("from 'react-native'") || lines[i].includes('from "react-native"')) {
        injectIndex = i + 1;
        foundRN = true;
        break;
      }
    }
    
    if (!foundRN) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          injectIndex = i;
          break;
        }
      }
    }

    lines.splice(injectIndex, 0, newImport.trim());
    content = lines.join('\n');
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf-8');
    modifiedCount++;
    console.log(`Updated ${file.split('/mobile/')[1]}`);
  }
});

console.log(`Updated ${modifiedCount} files.`);
