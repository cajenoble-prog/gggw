#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { mdToPdf } = require('md-to-pdf');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'review-pdfs');
const stylesheet = path.join(__dirname, 'review-pdf.css');
const excludedDirectories = new Set(['.git', 'node_modules', 'review-pdfs']);

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function findMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) {
      files.push(...await findMarkdownFiles(absolutePath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function renderFile(sourcePath) {
  const relativePath = path.relative(projectRoot, sourcePath);
  const destinationPath = path.join(
    outputRoot,
    relativePath.replace(/\.md$/i, '.pdf'),
  );
  const documentName = path.basename(relativePath, path.extname(relativePath));

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await mdToPdf(
    { path: sourcePath },
    {
      dest: destinationPath,
      basedir: projectRoot,
      stylesheet: [stylesheet],
      body_class: ['review-document'],
      document_title: documentName,
      pdf_options: {
        format: 'Letter',
        margin: {
          top: '0.65in',
          right: '0.6in',
          bottom: '0.7in',
          left: '0.6in',
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="box-sizing:border-box;color:#667085;font-family:Arial,sans-serif;font-size:8px;padding:0 0.6in;text-align:right;width:100%;">${escapeHtml(relativePath)} &nbsp;·&nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
      },
    },
  );

  console.log(`Rendered ${relativePath} -> ${path.relative(projectRoot, destinationPath)}`);
}

async function main() {
  const markdownFiles = (await findMarkdownFiles(projectRoot)).sort();

  if (markdownFiles.length === 0) {
    console.log('No Markdown documents found.');
    return;
  }

  await fs.rm(outputRoot, { recursive: true, force: true });

  for (const markdownFile of markdownFiles) {
    await renderFile(markdownFile);
  }

  console.log(`\nRendered ${markdownFiles.length} document(s) to ${path.relative(projectRoot, outputRoot)}/`);
}

main().catch((error) => {
  console.error('PDF rendering failed:', error.message);
  process.exitCode = 1;
});
