const fs = require('fs');
const path = require('path');

// Create public/pdfs directory if it doesn't exist
const pdfsDir = path.join(__dirname, 'public', 'pdfs');
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
}

// Simple PDF content using basic PDF format
const createSimplePDF = (title, content) => {
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

5 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
100 700 Td
(${title}) Tj
0 -50 Td
/F1 12 Tf
(${content}) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000079 00000 n
0000000173 00000 n
0000000301 00000 n
0000000380 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
625
%%EOF`;

  return pdfHeader;
};

// Create sample PDFs
const samplePDFs = [
  {
    filename: 'tamil-literature.pdf',
    title: 'Tamil Literature Classics',
    content: 'This is a sample Tamil literature document. It contains classical Tamil poetry and prose.'
  },
  {
    filename: 'english-grammar.pdf',
    title: 'English Grammar Guide',
    content: 'This is a comprehensive guide to English grammar for all levels. Learn about nouns, verbs, and more.'
  },
  {
    filename: 'science-tamil.pdf',
    title: 'Science in Tamil',
    content: 'Scientific concepts explained in simple Tamil. Physics, chemistry, and biology basics.'
  },
  {
    filename: 'hindi-spiritual.pdf',
    title: 'Hindi Spiritual Wisdom',
    content: 'Spiritual teachings and philosophy in Hindi. Ancient wisdom for modern times.'
  }
];

samplePDFs.forEach(pdf => {
  const pdfContent = createSimplePDF(pdf.title, pdf.content);
  const filePath = path.join(pdfsDir, pdf.filename);
  fs.writeFileSync(filePath, pdfContent);
  console.log(`✅ Created: ${pdf.filename}`);
});

console.log('🎉 Sample PDFs created successfully!');
console.log('📁 Location: backend/public/pdfs/');
console.log('🌐 Access via: http://localhost:3001/public/pdfs/filename.pdf');