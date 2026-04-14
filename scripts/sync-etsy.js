import fs from 'fs';
import path from 'path';

const etsyPath = '/Users/anassalama/Documents/POD & Design/Etsy/Work 2026/Meryem Work/etsy';
const projectPath = '/Users/anassalama/.gemini/antigravity/scratch/loom-and-layer';
const designsOutput = path.join(projectPath, 'src/assets/etsy-designs.json');
const mockupsOutput = path.join(projectPath, 'src/assets/default-mockups.json');

function syncAll() {
  console.log('🚀 Starting Full System Sync...');

  // 1. Sync Etsy Library
  const designs = [];
  try {
    const versions = fs.readdirSync(etsyPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && (dirent.name.startsWith('v') || dirent.name === 'done'));

    versions.forEach(vDir => {
      const vPath = path.join(etsyPath, vDir.name);
      const files = fs.readdirSync(vPath, { withFileTypes: true });
      files.forEach(file => {
        if (file.isFile() && file.name.endsWith('.png') && !isNaN(file.name.split('.')[0])) {
          const id = file.name.split('.')[0];
          const listingPath = path.join(vPath, 'listing');
          let mockups = [];
          if (fs.existsSync(listingPath)) {
            mockups = fs.readdirSync(listingPath)
              .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
              .map(f => `/etsy-assets/${vDir.name}/listing/${f}`);
          }
          designs.push({
            id,
            version: vDir.name,
            designPath: `/etsy-assets/${vDir.name}/${file.name}`,
            mockups,
            etsyLink: `https://www.etsy.com/listing/${id}`
          });
        }
      });
    });
    fs.writeFileSync(designsOutput, JSON.stringify(designs, null, 2));
    console.log(`✅ Etsy Library: ${designs.length} designs indexed.`);
  } catch (err) { console.error('Etsy Sync Error:', err); }

  // 2. Sync Local Mockups
  const mockupFiles = [];
  try {
    const mockupPath = path.join(projectPath, 'public/mockups');
    const files = fs.readdirSync(mockupPath);
    files.forEach(file => {
      if (file.endsWith('.png') || file.endsWith('.jpg')) {
        mockupFiles.push({
          name: path.parse(file).name,
          url: `/mockups/${file}`
        });
      }
    });
    fs.writeFileSync(mockupsOutput, JSON.stringify(mockupFiles, null, 2));
    console.log(`✅ Mockup Library: ${mockupFiles.length} mockups indexed.`);
  } catch (err) { console.error('Mockup Sync Error:', err); }
}

syncAll();
