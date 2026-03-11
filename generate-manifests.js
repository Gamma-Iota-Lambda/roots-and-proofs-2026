#!/usr/bin/env node

/**
 * GIL Photo Manifest Generator
 * Scans the assets/ directory and generates a photos.json manifest
 * in each event subfolder listing all image filenames.
 *
 * Usage:
 *   node generate-manifests.js                              — scan all top-level folders in assets/
 *   node generate-manifests.js mlk-2025                    — scan assets/mlk-2025/
 *   node generate-manifests.js roots-and-proofs-2026       — scan assets/roots-and-proofs-2026/
 *   node generate-manifests.js roots-and-proofs-2026/highlights  — scan that specific subfolder
 *   node generate-manifests.js assets/roots-and-proofs-2026/highlights  — full path also works
 *
 * Output per folder:
 *   <folder>/photos.json
 *
 * JSON format:
 *   {
 *     "event": "folder-name",
 *     "count": 12,
 *     "photos": [
 *       { "file": "photo1.jpg", "caption": "" },
 *       { "file": "photo2.jpg", "caption": "" }
 *     ]
 *   }
 *
 * To add captions, edit the photos.json after generation and fill in the
 * "caption" fields. Re-running will NOT overwrite existing captions.
 */

const fs = require('fs');
const path = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const ASSETS_DIR = path.join(__dirname, 'assets');
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MANIFEST = 'photos.json';
const SKIP_FOLDERS = ['originals'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isImage(filename) {
    return EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function naturalSort(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function processFolder(folderPath, label) {
    if (!fs.existsSync(folderPath)) {
        console.log(`  ❌ Folder not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath)
        .filter(f => {
            if (SKIP_FOLDERS.includes(f)) return false;
            if (!isImage(f)) return false;
            return fs.statSync(path.join(folderPath, f)).isFile();
        })
        .sort(naturalSort);

    if (files.length === 0) {
        console.log(`  ⚠  ${label} — no images found, skipping`);
        return;
    }

    const manifestPath = path.join(folderPath, MANIFEST);

    // Preserve any captions already written
    let existingCaptions = {};
    if (fs.existsSync(manifestPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            existing.photos?.forEach(p => {
                if (p.caption) existingCaptions[p.file] = p.caption;
            });
        } catch {
            // Malformed JSON — start fresh
        }
    }

    const photos = files.map(file => ({
        file,
        caption: existingCaptions[file] || ''
    }));

    const manifest = { event: label, count: photos.length, photos };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`  ✅ ${label.padEnd(45)} ${photos.length} photo(s) → ${MANIFEST}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function main() {
    const targetArg = process.argv[2];

    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR);
        console.log('Created assets/ folder — add event subfolders and photos, then re-run.\n');
        return;
    }

    // If a specific folder was passed, resolve and process just that one
    if (targetArg) {
        // Support both "roots-and-proofs-2026/highlights" and "assets/roots-and-proofs-2026/highlights"
        let resolvedPath;
        if (path.isAbsolute(targetArg)) {
            resolvedPath = targetArg;
        } else if (targetArg.startsWith('assets/') || targetArg.startsWith('assets\\')) {
            resolvedPath = path.join(__dirname, targetArg);
        } else {
            resolvedPath = path.join(ASSETS_DIR, targetArg);
        }

        const label = targetArg.replace(/^assets[/\\]/, '');
        console.log(`\nGenerating manifest for: ${label}\n`);
        processFolder(resolvedPath, label);
        console.log('\nDone.\n');
        return;
    }

    // No argument — scan all top-level folders in assets/
    const entries = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory() && !SKIP_FOLDERS.includes(e.name))
        .map(e => e.name)
        .sort(naturalSort);

    if (entries.length === 0) {
        console.log('No event subfolders found in assets/. Create folders like assets/mlk-2025/ and add photos.\n');
        return;
    }

    console.log(`\nGenerating manifests for ${entries.length} folder(s)...\n`);
    entries.forEach(name => processFolder(path.join(ASSETS_DIR, name), name));

    console.log('\nDone. Carousels will now auto-load photos from these manifests.');
    console.log('To add captions, edit the photos.json files and fill in the "caption" fields.');
    console.log('Re-running will preserve any captions you have written.\n');
}

main();